"""LinkyCluster cluster definition (auto-generated, DO NOT edit)."""

from __future__ import annotations

import typing
from dataclasses import dataclass, field
from enum import IntFlag

from ... import ChipUtility
from ...clusters.enum import MatterIntEnum
from ...tlv import float32, uint
from ..ClusterObjects import (Cluster, ClusterAttributeDescriptor, ClusterCommand, ClusterEvent, ClusterObject,
                              ClusterObjectDescriptor, ClusterObjectFieldDescriptor)
from ..Types import Nullable, NullValue


@dataclass
class LinkyCluster(Cluster):
    id: typing.ClassVar[int] = 0xFFF1FC01

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="optarif", Tag=0xFFF10000, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="demain", Tag=0xFFF10001, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="hhphc", Tag=0xFFF10002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ppot", Tag=0xFFF10003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="pejp", Tag=0xFFF10004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="adps", Tag=0xFFF10005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="adir1", Tag=0xFFF10006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="adir2", Tag=0xFFF10007, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="adir3", Tag=0xFFF10008, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="motdetat", Tag=0xFFF10009, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="tarifPeriod", Tag=0xFFF10010, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="periodicSend", Tag=0xFFF10100, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ltarf", Tag=0xFFF10200, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="ntarf", Tag=0xFFF10201, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="date", Tag=0xFFF10202, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="easd01", Tag=0xFFF10203, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="easd02", Tag=0xFFF10204, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="easd03", Tag=0xFFF10205, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="easd04", Tag=0xFFF10206, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="sinsti", Tag=0xFFF10207, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="smaxin", Tag=0xFFF10208, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="smaxin1", Tag=0xFFF10209, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ccain", Tag=0xFFF10210, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="ccain1", Tag=0xFFF10211, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="smaxsn11", Tag=0xFFF10212, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="smaxsn21", Tag=0xFFF10213, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="smaxsn31", Tag=0xFFF10214, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="msg1", Tag=0xFFF10215, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="msg2", Tag=0xFFF10216, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="stge", Tag=0xFFF10217, Type=typing.Optional[bytes]),
                ClusterObjectFieldDescriptor(Label="dpm1", Tag=0xFFF10218, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="fpm1", Tag=0xFFF10219, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="dpm2", Tag=0xFFF10220, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="fpm2", Tag=0xFFF10221, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="dpm3", Tag=0xFFF10222, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="fpm3", Tag=0xFFF10223, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="relais", Tag=0xFFF10224, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="njourf", Tag=0xFFF10225, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="njourf1", Tag=0xFFF10226, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="pjourf1", Tag=0xFFF10227, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="ppointe", Tag=0xFFF10228, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="mode", Tag=0xFFF10300, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="smaxsn1", Tag=0xFFF10400, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    optarif: typing.Optional[str] = None
    demain: typing.Optional[str] = None
    hhphc: typing.Optional[uint] = None
    ppot: typing.Optional[uint] = None
    pejp: typing.Optional[uint] = None
    adps: typing.Optional[uint] = None
    adir1: typing.Optional[uint] = None
    adir2: typing.Optional[uint] = None
    adir3: typing.Optional[uint] = None
    motdetat: typing.Optional[str] = None
    tarifPeriod: typing.Optional[str] = None
    periodicSend: typing.Optional[uint] = None
    ltarf: typing.Optional[str] = None
    ntarf: typing.Optional[uint] = None
    date: typing.Optional[str] = None
    easd01: typing.Optional[uint] = None
    easd02: typing.Optional[uint] = None
    easd03: typing.Optional[uint] = None
    easd04: typing.Optional[uint] = None
    sinsti: typing.Optional[uint] = None
    smaxin: typing.Optional[uint] = None
    smaxin1: typing.Optional[uint] = None
    ccain: typing.Optional[uint] = None
    ccain1: typing.Optional[uint] = None
    smaxsn11: typing.Optional[uint] = None
    smaxsn21: typing.Optional[uint] = None
    smaxsn31: typing.Optional[uint] = None
    msg1: typing.Optional[str] = None
    msg2: typing.Optional[str] = None
    stge: typing.Optional[bytes] = None
    dpm1: typing.Optional[uint] = None
    fpm1: typing.Optional[uint] = None
    dpm2: typing.Optional[uint] = None
    fpm2: typing.Optional[uint] = None
    dpm3: typing.Optional[uint] = None
    fpm3: typing.Optional[uint] = None
    relais: typing.Optional[uint] = None
    njourf: typing.Optional[uint] = None
    njourf1: typing.Optional[uint] = None
    pjourf1: typing.Optional[str] = None
    ppointe: typing.Optional[str] = None
    mode: typing.Optional[uint] = None
    smaxsn1: typing.Optional[uint] = None
    generatedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    acceptedCommandList: typing.List[uint] = field(default_factory=lambda: [])
    attributeList: typing.List[uint] = field(default_factory=lambda: [])
    featureMap: uint = 0
    clusterRevision: uint = 0

    class Attributes:
        @dataclass
        class Optarif(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Demain(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Hhphc(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Ppot(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Pejp(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Adps(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Adir1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Adir2(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Adir3(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Motdetat(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class TarifPeriod(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class PeriodicSend(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10100

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Ltarf(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10200

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Ntarf(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10201

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Date(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10202

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Easd01(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10203

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Easd02(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10204

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Easd03(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10205

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Easd04(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10206

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Sinsti(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10207

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Smaxin(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10208

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Smaxin1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10209

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Ccain(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10210

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Ccain1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10211

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Smaxsn11(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10212

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Smaxsn21(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10213

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Smaxsn31(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10214

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Msg1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10215

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Msg2(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10216

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Stge(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10217

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[bytes])

            value: typing.Optional[bytes] = None

        @dataclass
        class Dpm1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10218

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Fpm1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10219

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Dpm2(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10220

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Fpm2(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10221

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Dpm3(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10222

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Fpm3(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10223

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Relais(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10224

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Njourf(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10225

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Njourf1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10226

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Pjourf1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10227

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Ppointe(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10228

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: typing.Optional[str] = None

        @dataclass
        class Mode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10300

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class Smaxsn1(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0xFFF10400

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: typing.Optional[uint] = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF8

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AcceptedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFB

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: typing.List[uint] = field(default_factory=lambda: [])

        @dataclass
        class FeatureMap(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFC

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class ClusterRevision(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0xFFF1FC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
