"""Base classes for Matter cluster objects and global registration dictionaries.

Provides the infrastructure that generated cluster code (Objects.py) and
custom_clusters.py build upon.
"""

import enum
import typing
from dataclasses import asdict, dataclass, field, make_dataclass
from typing import Any, ClassVar, Dict, List, Mapping, Union

from .. import ChipUtility
from .. import tlv
from ..clusters.Types import Nullable, NullValue


def GetUnionUnderlyingType(typeToCheck, matchingType=None):
    """Retrieve the underlying type from a Union type annotation."""
    if not (typing.get_origin(typeToCheck) == typing.Union):
        return None

    for t in typing.get_args(typeToCheck):
        if matchingType is None:
            type_none = type(None)
            if t != type_none and t != Nullable:
                return t
        else:
            if t == matchingType:
                return t

    return None


@dataclass
class ClusterObjectFieldDescriptor:
    Label: str = ""
    Tag: typing.Optional[int] = None
    Type: type = type(None)

    def _PutSingleElementToTLV(
        self, tag, val, elementType, writer: tlv.TLVWriter, debugPath: str = "?"
    ):
        if issubclass(elementType, ClusterObject):
            if not isinstance(val, dict):
                raise ValueError(
                    f"Field {debugPath}.{self.Label} expected a struct, but got {type(val)}"
                )
            elementType.descriptor.DictToTLVWithWriter(
                f"{debugPath}.{self.Label}", tag, val, writer
            )
            return

        try:
            val = elementType(val)
        except Exception:
            raise ValueError(
                f"Field {debugPath}.{self.Label} expected {elementType}, but got {type(val)}"
            )
        writer.put(tag, val)

    def PutFieldToTLV(
        self, tag, val, writer: tlv.TLVWriter, debugPath: str = "?"
    ):
        if val == NullValue:
            if GetUnionUnderlyingType(self.Type, Nullable) is None:
                raise ValueError(
                    f"Field {debugPath}.{self.Label} was not nullable, but got a null"
                )
            writer.put(tag, None)
        elif val is None:
            if GetUnionUnderlyingType(self.Type, type(None)) is None:
                raise ValueError(
                    f"Field {debugPath}.{self.Label} was not optional, but encountered None"
                )
        else:
            elementType = GetUnionUnderlyingType(self.Type)
            if elementType is None:
                elementType = self.Type

            if not isinstance(val, List):
                self._PutSingleElementToTLV(tag, val, elementType, writer, debugPath)
                return

            writer.startArray(tag)
            (elementType,) = typing.get_args(elementType)
            for i, v in enumerate(val):
                self._PutSingleElementToTLV(
                    None, v, elementType, writer, debugPath + f"[{i}]"
                )
            writer.endContainer()


@dataclass
class ClusterObjectDescriptor:
    Fields: List[ClusterObjectFieldDescriptor]

    def GetFieldByTag(self, tag: int) -> typing.Optional[ClusterObjectFieldDescriptor]:
        for _field in self.Fields:
            if _field.Tag == tag:
                return _field
        return None

    def GetFieldByLabel(
        self, label: str
    ) -> typing.Optional[ClusterObjectFieldDescriptor]:
        for _field in self.Fields:
            if _field.Label == label:
                return _field
        return None

    def _ConvertNonArray(self, debugPath: str, elementType, value: Any) -> Any:
        if not issubclass(elementType, ClusterObject):
            if issubclass(elementType, enum.Enum):
                value = elementType(value)
            if not isinstance(value, elementType):
                raise ValueError(
                    f"Failed to decode field {debugPath}, expected type {elementType}, got {type(value)}"
                )
            return value
        if not isinstance(value, Mapping):
            raise ValueError(
                f"Failed to decode field {debugPath}, struct expected."
            )
        return elementType.descriptor.TagDictToLabelDict(debugPath, value)

    def TagDictToLabelDict(
        self, debugPath: str, tlvData: Dict[int, Any]
    ) -> Dict[str, Any]:
        ret: typing.Dict[Any, Any] = {}
        for tag, value in tlvData.items():
            descriptor = self.GetFieldByTag(tag)
            if not descriptor:
                ret[tag] = value
                continue

            if value is None:
                ret[descriptor.Label] = NullValue
                continue

            if typing.get_origin(descriptor.Type) == typing.Union:
                realType = GetUnionUnderlyingType(descriptor.Type)
                if realType is None:
                    raise ValueError(
                        f"Field {debugPath}.{descriptor.Label} has no valid underlying data model type"
                    )
                valueType = realType
            else:
                valueType = descriptor.Type

            if typing.get_origin(valueType) == list:
                listElementType = typing.get_args(valueType)[0]
                ret[descriptor.Label] = [
                    self._ConvertNonArray(
                        f"{debugPath}[{i}]", listElementType, v
                    )
                    for i, v in enumerate(value)
                ]
                continue
            ret[descriptor.Label] = self._ConvertNonArray(
                f"{debugPath}.{descriptor.Label}", valueType, value
            )
        return ret

    def TLVToDict(self, tlvBuf: bytes) -> Dict[str, Any]:
        tlvData = tlv.TLVReader(tlvBuf).get().get("Any", {})
        return self.TagDictToLabelDict("", tlvData)

    def DictToTLVWithWriter(
        self, debugPath: str, tag, data: Mapping, writer: tlv.TLVWriter
    ):
        writer.startStructure(tag)
        for _field in self.Fields:
            val = data.get(_field.Label, None)
            _field.PutFieldToTLV(
                _field.Tag, val, writer, debugPath + f".{_field.Label}"
            )
        writer.endContainer()

    def DictToTLV(self, data: dict) -> bytes:
        tlvwriter = tlv.TLVWriter(bytearray())
        self.DictToTLVWithWriter("", None, data, tlvwriter)
        return bytes(tlvwriter.encoding)


class ClusterObject:
    def ToTLV(self):
        return self.descriptor.DictToTLV(asdict(self))

    @classmethod
    def FromDict(cls, data: dict):
        from dacite import from_dict

        return from_dict(data_class=cls, data=data)

    @classmethod
    def FromTLV(cls, data: bytes):
        return cls.FromDict(data=cls.descriptor.TLVToDict(data))

    @ChipUtility.classproperty
    def descriptor(cls):
        raise NotImplementedError()


# Global registration dictionaries populated via __init_subclass__
ALL_CLUSTERS: typing.Dict = {}
ALL_ATTRIBUTES: typing.Dict = {}
ALL_ACCEPTED_COMMANDS: typing.Dict = {}
ALL_GENERATED_COMMANDS: typing.Dict = {}
ALL_EVENTS: typing.Dict = {}


class ClusterCommand(ClusterObject):
    def __init_subclass__(cls, *args, **kwargs) -> None:
        super().__init_subclass__(*args, **kwargs)
        try:
            if cls.is_client:
                if cls.cluster_id not in ALL_ACCEPTED_COMMANDS:
                    ALL_ACCEPTED_COMMANDS[cls.cluster_id] = {}
                ALL_ACCEPTED_COMMANDS[cls.cluster_id][cls.command_id] = cls
            else:
                if cls.cluster_id not in ALL_GENERATED_COMMANDS:
                    ALL_GENERATED_COMMANDS[cls.cluster_id] = {}
                ALL_GENERATED_COMMANDS[cls.cluster_id][cls.command_id] = cls
        except NotImplementedError:
            pass

    @ChipUtility.classproperty
    def cluster_id(self) -> int:
        raise NotImplementedError()

    @ChipUtility.classproperty
    def command_id(self) -> int:
        raise NotImplementedError()

    @ChipUtility.classproperty
    def must_use_timed_invoke(cls) -> bool:
        return False


class Cluster(ClusterObject):
    id: Any

    def __init_subclass__(cls, *args, **kwargs) -> None:
        super().__init_subclass__(*args, **kwargs)
        ALL_CLUSTERS[cls.id] = cls

    @property
    def data_version(self) -> int:
        return self._data_version

    def SetDataVersion(self, version: int) -> None:
        self._data_version = version


class ClusterAttributeDescriptor:
    def __init_subclass__(cls, *args, **kwargs) -> None:
        super().__init_subclass__(*args, **kwargs)
        if cls.standard_attribute:
            if cls.cluster_id not in ALL_ATTRIBUTES:
                ALL_ATTRIBUTES[cls.cluster_id] = {}
            ALL_ATTRIBUTES[cls.cluster_id][cls.attribute_id] = cls

    @classmethod
    def ToTLV(cls, tag: Union[int, None], value):
        writer = tlv.TLVWriter()
        wrapped_value = cls._cluster_object(Value=value)
        cls.attribute_type.PutFieldToTLV(
            tag, asdict(wrapped_value)["Value"], writer, ""
        )
        return writer.encoding

    @classmethod
    def FromTLV(cls, tlvBuffer: bytes):
        obj_class = cls._cluster_object
        return obj_class.FromDict(
            obj_class.descriptor.TagDictToLabelDict(
                "", {0: tlv.TLVReader(tlvBuffer).get().get("Any", {})}
            )
        ).Value

    @classmethod
    def FromTagDictOrRawValue(cls, val: Any):
        obj_class = cls._cluster_object
        return obj_class.FromDict(
            obj_class.descriptor.TagDictToLabelDict("", {0: val})
        ).Value

    @ChipUtility.classproperty
    def cluster_id(self) -> int:
        raise NotImplementedError()

    @ChipUtility.classproperty
    def attribute_id(self) -> int:
        raise NotImplementedError()

    @ChipUtility.classproperty
    def attribute_type(cls) -> ClusterObjectFieldDescriptor:
        raise NotImplementedError()

    @ChipUtility.classproperty
    def must_use_timed_write(cls) -> bool:
        return False

    @ChipUtility.classproperty
    def standard_attribute(cls) -> bool:
        return True

    @ChipUtility.classproperty
    def _cluster_object(cls) -> ClusterObject:
        return make_dataclass(
            "InternalClass",
            [
                ("Value", cls.attribute_type.Type, field(default=None)),
                (
                    "descriptor",
                    ClassVar[ClusterObjectDescriptor],
                    field(
                        default=ClusterObjectDescriptor(
                            Fields=[
                                ClusterObjectFieldDescriptor(
                                    Label="Value", Tag=0, Type=cls.attribute_type.Type
                                )
                            ]
                        )
                    ),
                ),
            ],
            bases=(ClusterObject,),
        )


class ClusterEvent(ClusterObject):
    def __init_subclass__(cls, *args, **kwargs) -> None:
        super().__init_subclass__(*args, **kwargs)
        if cls.cluster_id not in ALL_EVENTS:
            ALL_EVENTS[cls.cluster_id] = {}
        ALL_EVENTS[cls.cluster_id][cls.event_id] = cls

    @ChipUtility.classproperty
    def cluster_id(self) -> int:
        raise NotImplementedError()

    @ChipUtility.classproperty
    def event_id(self) -> int:
        raise NotImplementedError()
