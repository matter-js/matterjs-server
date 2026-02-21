"""ScenesManagement cluster definition (auto-generated, DO NOT edit)."""

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
from .Globals import Globals


@dataclass
class ScenesManagement(Cluster):
    id: typing.ClassVar[int] = 0x00000062

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="doNotUse", Tag=0x00000000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="sceneTableSize", Tag=0x00000001, Type=uint),
                ClusterObjectFieldDescriptor(Label="fabricSceneInfo", Tag=0x00000002, Type=typing.List[typing.Optional[ScenesManagement.Structs.SceneInfoStruct]]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    doNotUse: 'typing.Optional[uint]' = None
    sceneTableSize: 'uint' = 0
    fabricSceneInfo: 'typing.List[typing.Optional[ScenesManagement.Structs.SceneInfoStruct]]' = field(default_factory=lambda: [])
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Bitmaps:
        class Feature(IntFlag):
            kSceneNames = 0x1

        class CopyModeBitmap(IntFlag):
            kCopyAllScenes = 0x1

    class Structs:
        @dataclass
        class SceneInfoStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sceneCount", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="currentScene", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="currentGroup", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneValid", Tag=3, Type=bool),
                        ClusterObjectFieldDescriptor(Label="remainingCapacity", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="fabricIndex", Tag=254, Type=uint),
                    ])

            sceneCount: 'uint' = 0
            currentScene: 'uint' = 0
            currentGroup: 'uint' = 0
            sceneValid: 'bool' = False
            remainingCapacity: 'uint' = 0
            fabricIndex: 'uint' = 0

        @dataclass
        class AttributeValuePairStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="attributeId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="valueUnsigned8", Tag=1, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="valueSigned8", Tag=2, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="valueUnsigned16", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="valueSigned16", Tag=4, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="valueUnsigned32", Tag=5, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="valueSigned32", Tag=6, Type=typing.Optional[int]),
                        ClusterObjectFieldDescriptor(Label="valueUnsigned64", Tag=7, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="valueSigned64", Tag=8, Type=typing.Optional[int]),
                    ])

            attributeId: 'uint' = 0
            valueUnsigned8: 'typing.Optional[uint]' = None
            valueSigned8: 'typing.Optional[int]' = None
            valueUnsigned16: 'typing.Optional[uint]' = None
            valueSigned16: 'typing.Optional[int]' = None
            valueUnsigned32: 'typing.Optional[uint]' = None
            valueSigned32: 'typing.Optional[int]' = None
            valueUnsigned64: 'typing.Optional[uint]' = None
            valueSigned64: 'typing.Optional[int]' = None

        @dataclass
        class ExtensionFieldSetStruct(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="clusterId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="attributeValueList", Tag=1, Type=typing.List[typing.Optional[ScenesManagement.Structs.AttributeValuePairStruct]]),
                    ])

            clusterId: 'uint' = 0
            attributeValueList: 'typing.List[typing.Optional[ScenesManagement.Structs.AttributeValuePairStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class LogicalSceneTable(ClusterObject):
            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="sceneGroupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneName", Tag=2, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="sceneTransitionTime", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="extensionFields", Tag=4, Type=typing.List[typing.Optional[ScenesManagement.Structs.ExtensionFieldSetStruct]]),
                    ])

            sceneGroupId: 'uint' = 0
            sceneId: 'uint' = 0
            sceneName: 'typing.Optional[str]' = None
            sceneTransitionTime: 'uint' = 0
            extensionFields: 'typing.List[typing.Optional[ScenesManagement.Structs.ExtensionFieldSetStruct]]' = field(default_factory=lambda: [])

    class Commands:
        @dataclass
        class AddScene(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'AddSceneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneName", Tag=3, Type=str),
                        ClusterObjectFieldDescriptor(Label="extensionFieldSetStructs", Tag=4, Type=typing.List[typing.Optional[ScenesManagement.Structs.ExtensionFieldSetStruct]]),
                    ])

            groupId: 'uint' = 0
            sceneId: 'uint' = 0
            transitionTime: 'uint' = 0
            sceneName: 'str' = ""
            extensionFieldSetStructs: 'typing.List[typing.Optional[ScenesManagement.Structs.ExtensionFieldSetStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class ViewScene(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'ViewSceneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=1, Type=uint),
                    ])

            groupId: 'uint' = 0
            sceneId: 'uint' = 0

        @dataclass
        class RemoveScene(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'RemoveSceneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=1, Type=uint),
                    ])

            groupId: 'uint' = 0
            sceneId: 'uint' = 0

        @dataclass
        class RemoveAllScenes(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'RemoveAllScenesResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                    ])

            groupId: 'uint' = 0

        @dataclass
        class StoreScene(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'StoreSceneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=1, Type=uint),
                    ])

            groupId: 'uint' = 0
            sceneId: 'uint' = 0

        @dataclass
        class RecallScene(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=typing.Union[None, Nullable, uint]),
                    ])

            groupId: 'uint' = 0
            sceneId: 'uint' = 0
            transitionTime: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GetSceneMembership(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'GetSceneMembershipResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=0, Type=uint),
                    ])

            groupId: 'uint' = 0

        @dataclass
        class CopyScene(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000040
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = 'CopySceneResponse'

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="mode", Tag=0, Type=ScenesManagement.Bitmaps.CopyModeBitmap),
                        ClusterObjectFieldDescriptor(Label="groupIdentifierFrom", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneIdentifierFrom", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="groupIdentifierTo", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneIdentifierTo", Tag=4, Type=uint),
                    ])

            mode: 'ScenesManagement.Bitmaps.CopyModeBitmap' = 0
            groupIdentifierFrom: 'uint' = 0
            sceneIdentifierFrom: 'uint' = 0
            groupIdentifierTo: 'uint' = 0
            sceneIdentifierTo: 'uint' = 0

        @dataclass
        class AddSceneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=2, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0
            sceneId: 'uint' = 0

        @dataclass
        class ViewSceneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=3, Type=typing.Optional[uint]),
                        ClusterObjectFieldDescriptor(Label="sceneName", Tag=4, Type=typing.Optional[str]),
                        ClusterObjectFieldDescriptor(Label="extensionFieldSetStructs", Tag=5, Type=typing.Optional[typing.List[typing.Optional[ScenesManagement.Structs.ExtensionFieldSetStruct]]]),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0
            sceneId: 'uint' = 0
            transitionTime: 'typing.Optional[uint]' = None
            sceneName: 'typing.Optional[str]' = None
            extensionFieldSetStructs: 'typing.Optional[typing.List[typing.Optional[ScenesManagement.Structs.ExtensionFieldSetStruct]]]' = None

        @dataclass
        class RemoveSceneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=2, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0
            sceneId: 'uint' = 0

        @dataclass
        class RemoveAllScenesResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0

        @dataclass
        class StoreSceneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneId", Tag=2, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupId: 'uint' = 0
            sceneId: 'uint' = 0

        @dataclass
        class GetSceneMembershipResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="capacity", Tag=1, Type=typing.Union[Nullable, uint]),
                        ClusterObjectFieldDescriptor(Label="groupId", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneList", Tag=3, Type=typing.Optional[typing.List[typing.Optional[uint]]]),
                    ])

            status: 'Globals.Enums.status' = 0
            capacity: 'typing.Union[Nullable, uint]' = NullValue
            groupId: 'uint' = 0
            sceneList: 'typing.Optional[typing.List[typing.Optional[uint]]]' = None

        @dataclass
        class CopySceneResponse(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000062
            command_id: typing.ClassVar[int] = 0x00000040
            is_client: typing.ClassVar[bool] = False
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="status", Tag=0, Type=Globals.Enums.status),
                        ClusterObjectFieldDescriptor(Label="groupIdentifierFrom", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="sceneIdentifierFrom", Tag=2, Type=uint),
                    ])

            status: 'Globals.Enums.status' = 0
            groupIdentifierFrom: 'uint' = 0
            sceneIdentifierFrom: 'uint' = 0

    class Attributes:
        @dataclass
        class DoNotUse(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class SceneTableSize(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class FabricSceneInfo(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[typing.Optional[ScenesManagement.Structs.SceneInfoStruct]])

            value: 'typing.List[typing.Optional[ScenesManagement.Structs.SceneInfoStruct]]' = field(default_factory=lambda: [])

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF8

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: 'typing.List[uint]' = field(default_factory=lambda: [])

        @dataclass
        class AcceptedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFF9

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: 'typing.List[uint]' = field(default_factory=lambda: [])

        @dataclass
        class AttributeList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFB

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.List[uint])

            value: 'typing.List[uint]' = field(default_factory=lambda: [])

        @dataclass
        class FeatureMap(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFC

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0

        @dataclass
        class ClusterRevision(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000062

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
