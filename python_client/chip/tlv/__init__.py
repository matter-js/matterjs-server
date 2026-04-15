"""Minimal reimplementation of chip.tlv for matter-python-client.

Provides uint, float32, TLVList, TLVWriter and TLVReader types used by
ClusterObjects for serialization/deserialization.
"""

from __future__ import absolute_import, print_function

import struct
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from enum import Enum

from .tlvlist import TLVList

TLV_TYPE_SIGNED_INTEGER = 0x00
TLV_TYPE_UNSIGNED_INTEGER = 0x04
TLV_TYPE_BOOLEAN = 0x08
TLV_TYPE_FLOATING_POINT_NUMBER = 0x0A
TLV_TYPE_UTF8_STRING = 0x0C
TLV_TYPE_BYTE_STRING = 0x10
TLV_TYPE_NULL = 0x14
TLV_TYPE_STRUCTURE = 0x15
TLV_TYPE_ARRAY = 0x16
TLV_TYPE_PATH = 0x17

TLV_TAG_CONTROL_ANONYMOUS = 0x00
TLV_TAG_CONTROL_CONTEXT_SPECIFIC = 0x20

TLVBoolean_False = TLV_TYPE_BOOLEAN
TLVBoolean_True = TLV_TYPE_BOOLEAN + 1

TLVEndOfContainer = 0x18

INT8_MIN = -128
INT16_MIN = -32768
INT32_MIN = -2147483648
INT64_MIN = -9223372036854775808

INT8_MAX = 127
INT16_MAX = 32767
INT32_MAX = 2147483647
INT64_MAX = 9223372036854775807

UINT8_MAX = 255
UINT16_MAX = 65535
UINT32_MAX = 4294967295
UINT64_MAX = 18446744073709551615


class uint(int):
    """Unsigned integer type for Matter data model."""

    def __init__(self, val: int):
        if val < 0:
            raise TypeError(
                "expecting positive value, got negative value of %d instead" % val
            )


class float32(float):
    """Single-precision float type distinct from Python's double-precision float."""

    pass


class TLVWriter:
    def __init__(self, encoding=None, implicitProfile=None):
        self._encoding = encoding if encoding is not None else bytearray()
        self._implicitProfile = implicitProfile
        self._containerStack = []

    @property
    def encoding(self):
        return self._encoding

    @encoding.setter
    def encoding(self, val):
        self._encoding = val

    def put(self, tag, val):
        if val is None:
            self.putNull(tag)
        elif isinstance(val, Enum):
            self.putUnsignedInt(tag, val)
        elif isinstance(val, bool):
            self.putBool(tag, val)
        elif isinstance(val, uint):
            self.putUnsignedInt(tag, val)
        elif isinstance(val, int):
            self.putSignedInt(tag, val)
        elif isinstance(val, float32):
            self.putFloat(tag, val)
        elif isinstance(val, float):
            self.putDouble(tag, val)
        elif isinstance(val, str):
            self.putString(tag, val)
        elif isinstance(val, (bytes, bytearray)):
            self.putBytes(tag, val)
        elif isinstance(val, Mapping):
            self.startStructure(tag)
            if type(val) is dict:
                val = OrderedDict(
                    sorted(val.items(), key=lambda item: tlvTagToSortKey(item[0]))
                )
            for containedTag, containedVal in val.items():
                self.put(containedTag, containedVal)
            self.endContainer()
        elif isinstance(val, TLVList):
            self.startPath(tag)
            for containedTag, containedVal in val:
                self.put(containedTag, containedVal)
            self.endContainer()
        elif isinstance(val, Sequence):
            self.startArray(tag)
            for containedVal in val:
                self.put(None, containedVal)
            self.endContainer()
        else:
            raise ValueError("Attempt to TLV encode unsupported value")

    def putSignedInt(self, tag, val):
        if val >= INT8_MIN and val <= INT8_MAX:
            fmt = "<b"
        elif val >= INT16_MIN and val <= INT16_MAX:
            fmt = "<h"
        elif val >= INT32_MIN and val <= INT32_MAX:
            fmt = "<l"
        elif val >= INT64_MIN and val <= INT64_MAX:
            fmt = "<q"
        else:
            raise ValueError("Integer value out of range")
        val = struct.pack(fmt, val)
        controlAndTag = self._encodeControlAndTag(
            TLV_TYPE_SIGNED_INTEGER, tag, lenOfLenOrVal=len(val)
        )
        self._encoding.extend(controlAndTag)
        self._encoding.extend(val)

    def putUnsignedInt(self, tag, val):
        val = self._encodeUnsignedInt(val)
        controlAndTag = self._encodeControlAndTag(
            TLV_TYPE_UNSIGNED_INTEGER, tag, lenOfLenOrVal=len(val)
        )
        self._encoding.extend(controlAndTag)
        self._encoding.extend(val)

    def putFloat(self, tag, val):
        val = struct.pack("f", val)
        controlAndTag = self._encodeControlAndTag(
            TLV_TYPE_FLOATING_POINT_NUMBER, tag, lenOfLenOrVal=len(val)
        )
        self._encoding.extend(controlAndTag)
        self._encoding.extend(val)

    def putDouble(self, tag, val):
        val = struct.pack("d", val)
        controlAndTag = self._encodeControlAndTag(
            TLV_TYPE_FLOATING_POINT_NUMBER, tag, lenOfLenOrVal=len(val)
        )
        self._encoding.extend(controlAndTag)
        self._encoding.extend(val)

    def putString(self, tag, val):
        val = val.encode("utf-8")
        valLen = self._encodeUnsignedInt(len(val))
        controlAndTag = self._encodeControlAndTag(
            TLV_TYPE_UTF8_STRING, tag, lenOfLenOrVal=len(valLen)
        )
        self._encoding.extend(controlAndTag)
        self._encoding.extend(valLen)
        self._encoding.extend(val)

    def putBytes(self, tag, val):
        valLen = self._encodeUnsignedInt(len(val))
        controlAndTag = self._encodeControlAndTag(
            TLV_TYPE_BYTE_STRING, tag, lenOfLenOrVal=len(valLen)
        )
        self._encoding.extend(controlAndTag)
        self._encoding.extend(valLen)
        self._encoding.extend(val)

    def putBool(self, tag, val):
        t = TLVBoolean_True if val else TLVBoolean_False
        controlAndTag = self._encodeControlAndTag(t, tag)
        self._encoding.extend(controlAndTag)

    def putNull(self, tag):
        controlAndTag = self._encodeControlAndTag(TLV_TYPE_NULL, tag)
        self._encoding.extend(controlAndTag)

    def startContainer(self, tag, containerType):
        controlAndTag = self._encodeControlAndTag(containerType, tag)
        self._encoding.extend(controlAndTag)
        self._containerStack.insert(0, containerType)

    def startStructure(self, tag):
        self.startContainer(tag, containerType=TLV_TYPE_STRUCTURE)

    def startArray(self, tag):
        self.startContainer(tag, containerType=TLV_TYPE_ARRAY)

    def startPath(self, tag):
        self.startContainer(tag, containerType=TLV_TYPE_PATH)

    def endContainer(self):
        self._containerStack.pop(0)
        controlAndTag = self._encodeControlAndTag(TLVEndOfContainer, None)
        self._encoding.extend(controlAndTag)

    def _encodeControlAndTag(self, type, tag, lenOfLenOrVal=0):
        controlByte = type
        if lenOfLenOrVal == 2:
            controlByte |= 1
        elif lenOfLenOrVal == 4:
            controlByte |= 2
        elif lenOfLenOrVal == 8:
            controlByte |= 3
        if tag is None:
            if (
                type != TLVEndOfContainer
                and len(self._containerStack) != 0
                and self._containerStack[0] == TLV_TYPE_STRUCTURE
            ):
                raise ValueError("Attempt to encode anonymous tag within TLV structure")
            controlByte |= TLV_TAG_CONTROL_ANONYMOUS
            return struct.pack("<B", controlByte)
        if isinstance(tag, int):
            if tag < 0 or tag > UINT8_MAX:
                raise ValueError("Context-specific TLV tag number out of range")
            if len(self._containerStack) == 0:
                raise ValueError(
                    "Attempt to encode context-specific TLV tag at top level"
                )
            if self._containerStack[0] == TLV_TYPE_ARRAY:
                raise ValueError(
                    "Attempt to encode context-specific tag within TLV array"
                )
            controlByte |= TLV_TAG_CONTROL_CONTEXT_SPECIFIC
            return struct.pack("<BB", controlByte, tag)
        raise ValueError("Invalid object given for TLV tag")

    @staticmethod
    def _encodeUnsignedInt(val):
        if val < 0:
            raise ValueError("Integer value out of range")
        if val <= UINT8_MAX:
            fmt = "<B"
        elif val <= UINT16_MAX:
            fmt = "<H"
        elif val <= UINT32_MAX:
            fmt = "<L"
        elif val <= UINT64_MAX:
            fmt = "<Q"
        else:
            raise ValueError("Integer value out of range")
        return struct.pack(fmt, val)


class TLVReader:
    def __init__(self, tlv):
        self._tlv = tlv
        self._bytesRead = 0
        self._decodings = []

    def get(self):
        out = {}
        self._get(self._tlv, self._decodings, out)
        return out

    def _decodeControlAndTag(self, tlv, decoding):
        (controlByte,) = struct.unpack("<B", tlv[self._bytesRead : self._bytesRead + 1])
        tagControl = controlByte & 0xE0
        elementType = controlByte & 0x1F
        decoding["type"] = elementType
        self._bytesRead += 1

        if tagControl == TLV_TAG_CONTROL_ANONYMOUS:
            decoding["tag"] = None
        elif tagControl == TLV_TAG_CONTROL_CONTEXT_SPECIFIC:
            (decoding["tag"],) = struct.unpack(
                "<B", tlv[self._bytesRead : self._bytesRead + 1]
            )
            self._bytesRead += 1
        else:
            decoding["tag"] = None

    def _decodeVal(self, tlv, decoding):
        t = decoding["type"]
        if t == TLV_TYPE_STRUCTURE:
            decoding["value"] = {}
            self._get(tlv, [], decoding["value"])
        elif t == TLV_TYPE_ARRAY:
            decoding["value"] = []
            self._get(tlv, [], decoding["value"])
        elif t == TLV_TYPE_NULL:
            decoding["value"] = None
        elif t == TLVEndOfContainer:
            decoding["value"] = None
        elif t == TLVBoolean_True:
            decoding["value"] = True
        elif t == TLVBoolean_False:
            decoding["value"] = False
        elif t >= 0x00 and t <= 0x03:
            # Signed integers 1/2/4/8 byte
            sizes = {0: ("<b", 1), 1: ("<h", 2), 2: ("<l", 4), 3: ("<q", 8)}
            fmt, size = sizes[t - TLV_TYPE_SIGNED_INTEGER]
            (decoding["value"],) = struct.unpack(
                fmt, tlv[self._bytesRead : self._bytesRead + size]
            )
            self._bytesRead += size
        elif t >= 0x04 and t <= 0x07:
            # Unsigned integers 1/2/4/8 byte
            sizes = {0: ("<B", 1), 1: ("<H", 2), 2: ("<L", 4), 3: ("<Q", 8)}
            fmt, size = sizes[t - TLV_TYPE_UNSIGNED_INTEGER]
            (decoding["value"],) = struct.unpack(
                fmt, tlv[self._bytesRead : self._bytesRead + size]
            )
            decoding["value"] = uint(decoding["value"])
            self._bytesRead += size
        elif t == 0x0A:
            (decoding["value"],) = struct.unpack(
                "<f", tlv[self._bytesRead : self._bytesRead + 4]
            )
            decoding["value"] = float32(decoding["value"])
            self._bytesRead += 4
        elif t == 0x0B:
            (decoding["value"],) = struct.unpack(
                "<d", tlv[self._bytesRead : self._bytesRead + 8]
            )
            self._bytesRead += 8
        elif t >= 0x0C and t <= 0x0F:
            # UTF-8 strings
            lenSizes = {0: ("<B", 1), 1: ("<H", 2), 2: ("<L", 4), 3: ("<Q", 8)}
            fmt, size = lenSizes[t - TLV_TYPE_UTF8_STRING]
            (strLen,) = struct.unpack(
                fmt, tlv[self._bytesRead : self._bytesRead + size]
            )
            self._bytesRead += size
            val = tlv[self._bytesRead : self._bytesRead + strLen]
            try:
                decoding["value"] = val.decode("utf-8")
            except Exception:
                decoding["value"] = val
            self._bytesRead += strLen
        elif t >= 0x10 and t <= 0x13:
            # Byte strings
            lenSizes = {0: ("<B", 1), 1: ("<H", 2), 2: ("<L", 4), 3: ("<Q", 8)}
            fmt, size = lenSizes[t - TLV_TYPE_BYTE_STRING]
            (strLen,) = struct.unpack(
                fmt, tlv[self._bytesRead : self._bytesRead + size]
            )
            self._bytesRead += size
            decoding["value"] = bytes(
                tlv[self._bytesRead : self._bytesRead + strLen]
            )
            self._bytesRead += strLen
        else:
            raise ValueError("Attempt to decode unsupported TLV type")

    def _get(self, tlv, decodings, out):
        while len(tlv[self._bytesRead :]) > 0:
            decoding = {}
            self._decodeControlAndTag(tlv, decoding)
            self._decodeVal(tlv, decoding)
            decodings.append(decoding)

            if decoding["type"] == TLVEndOfContainer:
                break
            else:
                tag = decoding["tag"]
                if isinstance(out, dict):
                    key = tag if tag is not None else "Any"
                    out[key] = decoding["value"]
                elif isinstance(out, list):
                    out.append(decoding["value"])


def tlvTagToSortKey(tag):
    if tag is None:
        return -1
    if isinstance(tag, int):
        majorOrder = 0
    elif isinstance(tag, tuple):
        (profileId, tag) = tag
        if profileId is None:
            majorOrder = 1
        else:
            majorOrder = profileId + 2
    else:
        raise ValueError("Invalid TLV tag")
    return (majorOrder << 32) + tag
