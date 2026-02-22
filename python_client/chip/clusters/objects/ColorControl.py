"""ColorControl cluster definition (auto-generated, DO NOT edit)."""

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
class ColorControl(Cluster):
    id: typing.ClassVar[int] = 0x00000300

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(Label="currentHue", Tag=0x00000000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="currentSaturation", Tag=0x00000001, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="remainingTime", Tag=0x00000002, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="currentX", Tag=0x00000003, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="currentY", Tag=0x00000004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="driftCompensation", Tag=0x00000005, Type=typing.Optional[ColorControl.Enums.DriftCompensationEnum]),
                ClusterObjectFieldDescriptor(Label="compensationText", Tag=0x00000006, Type=typing.Optional[str]),
                ClusterObjectFieldDescriptor(Label="colorTemperatureMireds", Tag=0x00000007, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorMode", Tag=0x00000008, Type=ColorControl.Enums.ColorModeEnum),
                ClusterObjectFieldDescriptor(Label="options", Tag=0x0000000F, Type=ColorControl.Bitmaps.OptionsBitmap),
                ClusterObjectFieldDescriptor(Label="numberOfPrimaries", Tag=0x00000010, Type=typing.Union[Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="primary1X", Tag=0x00000011, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary1Y", Tag=0x00000012, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary1Intensity", Tag=0x00000013, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="primary2X", Tag=0x00000015, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary2Y", Tag=0x00000016, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary2Intensity", Tag=0x00000017, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="primary3X", Tag=0x00000019, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary3Y", Tag=0x0000001A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary3Intensity", Tag=0x0000001B, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="primary4X", Tag=0x00000020, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary4Y", Tag=0x00000021, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary4Intensity", Tag=0x00000022, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="primary5X", Tag=0x00000024, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary5Y", Tag=0x00000025, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary5Intensity", Tag=0x00000026, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="primary6X", Tag=0x00000028, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary6Y", Tag=0x00000029, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="primary6Intensity", Tag=0x0000002A, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="whitePointX", Tag=0x00000030, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="whitePointY", Tag=0x00000031, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointRx", Tag=0x00000032, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointRy", Tag=0x00000033, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointRIntensity", Tag=0x00000034, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="colorPointGx", Tag=0x00000036, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointGy", Tag=0x00000037, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointGIntensity", Tag=0x00000038, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="colorPointBx", Tag=0x0000003A, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointBy", Tag=0x0000003B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorPointBIntensity", Tag=0x0000003C, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="enhancedCurrentHue", Tag=0x00004000, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="enhancedColorMode", Tag=0x00004001, Type=ColorControl.Enums.EnhancedColorModeEnum),
                ClusterObjectFieldDescriptor(Label="colorLoopActive", Tag=0x00004002, Type=typing.Optional[Globals.Enums.enum8]),
                ClusterObjectFieldDescriptor(Label="colorLoopDirection", Tag=0x00004003, Type=typing.Optional[ColorControl.Enums.ColorLoopDirectionEnum]),
                ClusterObjectFieldDescriptor(Label="colorLoopTime", Tag=0x00004004, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorLoopStartEnhancedHue", Tag=0x00004005, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorLoopStoredEnhancedHue", Tag=0x00004006, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorCapabilities", Tag=0x0000400A, Type=Globals.Bitmaps.map16),
                ClusterObjectFieldDescriptor(Label="colorTempPhysicalMinMireds", Tag=0x0000400B, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="colorTempPhysicalMaxMireds", Tag=0x0000400C, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="coupleColorTempToLevelMinMireds", Tag=0x0000400D, Type=typing.Optional[uint]),
                ClusterObjectFieldDescriptor(Label="startUpColorTemperatureMireds", Tag=0x00004010, Type=typing.Union[None, Nullable, uint]),
                ClusterObjectFieldDescriptor(Label="generatedCommandList", Tag=0x0000FFF8, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="acceptedCommandList", Tag=0x0000FFF9, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="attributeList", Tag=0x0000FFFB, Type=typing.List[uint]),
                ClusterObjectFieldDescriptor(Label="featureMap", Tag=0x0000FFFC, Type=uint),
                ClusterObjectFieldDescriptor(Label="clusterRevision", Tag=0x0000FFFD, Type=uint),
            ])

    currentHue: 'typing.Optional[uint]' = None
    currentSaturation: 'typing.Optional[uint]' = None
    remainingTime: 'typing.Optional[uint]' = None
    currentX: 'typing.Optional[uint]' = None
    currentY: 'typing.Optional[uint]' = None
    driftCompensation: 'typing.Optional[ColorControl.Enums.DriftCompensationEnum]' = None
    compensationText: 'typing.Optional[str]' = None
    colorTemperatureMireds: 'typing.Optional[uint]' = None
    colorMode: 'ColorControl.Enums.ColorModeEnum' = 0
    options: 'ColorControl.Bitmaps.OptionsBitmap' = 0
    numberOfPrimaries: 'typing.Union[Nullable, uint]' = NullValue
    primary1X: 'typing.Optional[uint]' = None
    primary1Y: 'typing.Optional[uint]' = None
    primary1Intensity: 'typing.Union[None, Nullable, uint]' = None
    primary2X: 'typing.Optional[uint]' = None
    primary2Y: 'typing.Optional[uint]' = None
    primary2Intensity: 'typing.Union[None, Nullable, uint]' = None
    primary3X: 'typing.Optional[uint]' = None
    primary3Y: 'typing.Optional[uint]' = None
    primary3Intensity: 'typing.Union[None, Nullable, uint]' = None
    primary4X: 'typing.Optional[uint]' = None
    primary4Y: 'typing.Optional[uint]' = None
    primary4Intensity: 'typing.Union[None, Nullable, uint]' = None
    primary5X: 'typing.Optional[uint]' = None
    primary5Y: 'typing.Optional[uint]' = None
    primary5Intensity: 'typing.Union[None, Nullable, uint]' = None
    primary6X: 'typing.Optional[uint]' = None
    primary6Y: 'typing.Optional[uint]' = None
    primary6Intensity: 'typing.Union[None, Nullable, uint]' = None
    whitePointX: 'typing.Optional[uint]' = None
    whitePointY: 'typing.Optional[uint]' = None
    colorPointRx: 'typing.Optional[uint]' = None
    colorPointRy: 'typing.Optional[uint]' = None
    colorPointRIntensity: 'typing.Union[None, Nullable, uint]' = None
    colorPointGx: 'typing.Optional[uint]' = None
    colorPointGy: 'typing.Optional[uint]' = None
    colorPointGIntensity: 'typing.Union[None, Nullable, uint]' = None
    colorPointBx: 'typing.Optional[uint]' = None
    colorPointBy: 'typing.Optional[uint]' = None
    colorPointBIntensity: 'typing.Union[None, Nullable, uint]' = None
    enhancedCurrentHue: 'typing.Optional[uint]' = None
    enhancedColorMode: 'ColorControl.Enums.EnhancedColorModeEnum' = 0
    colorLoopActive: 'typing.Optional[Globals.Enums.enum8]' = None
    colorLoopDirection: 'typing.Optional[ColorControl.Enums.ColorLoopDirectionEnum]' = None
    colorLoopTime: 'typing.Optional[uint]' = None
    colorLoopStartEnhancedHue: 'typing.Optional[uint]' = None
    colorLoopStoredEnhancedHue: 'typing.Optional[uint]' = None
    colorCapabilities: 'Globals.Bitmaps.map16' = 0
    colorTempPhysicalMinMireds: 'typing.Optional[uint]' = None
    colorTempPhysicalMaxMireds: 'typing.Optional[uint]' = None
    coupleColorTempToLevelMinMireds: 'typing.Optional[uint]' = None
    startUpColorTemperatureMireds: 'typing.Union[None, Nullable, uint]' = None
    generatedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    acceptedCommandList: 'typing.List[uint]' = field(default_factory=lambda: [])
    attributeList: 'typing.List[uint]' = field(default_factory=lambda: [])
    featureMap: 'uint' = 0
    clusterRevision: 'uint' = 0

    class Enums:
        class DriftCompensationEnum(MatterIntEnum):
            kNone = 0x00
            kOtherOrUnknown = 0x01
            kTemperatureMonitoring = 0x02
            kOpticalLuminanceMonitoringAndFeedback = 0x03
            kOpticalColorMonitoringAndFeedback = 0x04
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 5

        class ColorModeEnum(MatterIntEnum):
            kCurrentHueAndCurrentSaturation = 0x00
            kCurrentXAndCurrentY = 0x01
            kColorTemperatureMireds = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class EnhancedColorModeEnum(MatterIntEnum):
            kCurrentHueAndCurrentSaturation = 0x00
            kCurrentXAndCurrentY = 0x01
            kColorTemperatureMireds = 0x02
            kEnhancedCurrentHueAndCurrentSaturation = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class DirectionEnum(MatterIntEnum):
            kShortest = 0x00
            kLongest = 0x01
            kUp = 0x02
            kDown = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class MoveModeEnum(MatterIntEnum):
            kStop = 0x00
            kUp = 0x01
            kDown = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class StepModeEnum(MatterIntEnum):
            kUp = 0x01
            kDown = 0x03
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 4

        class ColorLoopActionEnum(MatterIntEnum):
            kDeactivate = 0x00
            kActivateFromColorLoopStartEnhancedHue = 0x01
            kActivateFromEnhancedCurrentHue = 0x02
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 3

        class ColorLoopDirectionEnum(MatterIntEnum):
            kDecrement = 0x00
            kIncrement = 0x01
            # All received enum values that are not listed above will be mapped
            # to kUnknownEnumValue. This is a helper enum value that should only
            # be used by code to process how it handles receiving an unknown
            # enum value. This specific value should never be transmitted.
            kUnknownEnumValue = 2

    class Bitmaps:
        class Feature(IntFlag):
            kHueSaturation = 0x1
            kEnhancedHue = 0x2
            kColorLoop = 0x4
            kXy = 0x8
            kColorTemperature = 0x10

        class OptionsBitmap(IntFlag):
            kExecuteIfOff = 0x1

        class UpdateFlagsBitmap(IntFlag):
            kUpdateAction = 0x1
            kUpdateDirection = 0x2
            kUpdateTime = 0x4
            kUpdateStartHue = 0x8

    class Commands:
        @dataclass
        class MoveToHue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000000
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="hue", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="direction", Tag=1, Type=ColorControl.Enums.DirectionEnum),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            hue: 'uint' = 0
            direction: 'ColorControl.Enums.DirectionEnum' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveHue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000001
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="moveMode", Tag=0, Type=ColorControl.Enums.MoveModeEnum),
                        ClusterObjectFieldDescriptor(Label="rate", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=2, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            moveMode: 'ColorControl.Enums.MoveModeEnum' = 0
            rate: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class StepHue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000002
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="stepMode", Tag=0, Type=ColorControl.Enums.StepModeEnum),
                        ClusterObjectFieldDescriptor(Label="stepSize", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            stepMode: 'ColorControl.Enums.StepModeEnum' = 0
            stepSize: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveToSaturation(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000003
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="saturation", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=2, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            saturation: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveSaturation(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000004
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="moveMode", Tag=0, Type=ColorControl.Enums.MoveModeEnum),
                        ClusterObjectFieldDescriptor(Label="rate", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=2, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            moveMode: 'ColorControl.Enums.MoveModeEnum' = 0
            rate: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class StepSaturation(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000005
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="stepMode", Tag=0, Type=ColorControl.Enums.StepModeEnum),
                        ClusterObjectFieldDescriptor(Label="stepSize", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            stepMode: 'ColorControl.Enums.StepModeEnum' = 0
            stepSize: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveToHueAndSaturation(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000006
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="hue", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="saturation", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            hue: 'uint' = 0
            saturation: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveToColor(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000007
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="colorX", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="colorY", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            colorX: 'uint' = 0
            colorY: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveColor(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000008
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="rateX", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="rateY", Tag=1, Type=int),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=2, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            rateX: 'int' = 0
            rateY: 'int' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class StepColor(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000009
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="stepX", Tag=0, Type=int),
                        ClusterObjectFieldDescriptor(Label="stepY", Tag=1, Type=int),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            stepX: 'int' = 0
            stepY: 'int' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveToColorTemperature(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x0000000A
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="colorTemperatureMireds", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=2, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            colorTemperatureMireds: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class EnhancedMoveToHue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000040
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="enhancedHue", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="direction", Tag=1, Type=ColorControl.Enums.DirectionEnum),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            enhancedHue: 'uint' = 0
            direction: 'ColorControl.Enums.DirectionEnum' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class EnhancedMoveHue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000041
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="moveMode", Tag=0, Type=ColorControl.Enums.MoveModeEnum),
                        ClusterObjectFieldDescriptor(Label="rate", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=2, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            moveMode: 'ColorControl.Enums.MoveModeEnum' = 0
            rate: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class EnhancedStepHue(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000042
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="stepMode", Tag=0, Type=ColorControl.Enums.StepModeEnum),
                        ClusterObjectFieldDescriptor(Label="stepSize", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            stepMode: 'ColorControl.Enums.StepModeEnum' = 0
            stepSize: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class EnhancedMoveToHueAndSaturation(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000043
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="enhancedHue", Tag=0, Type=uint),
                        ClusterObjectFieldDescriptor(Label="saturation", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=3, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            enhancedHue: 'uint' = 0
            saturation: 'uint' = 0
            transitionTime: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class ColorLoopSet(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000044
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="updateFlags", Tag=0, Type=ColorControl.Bitmaps.UpdateFlagsBitmap),
                        ClusterObjectFieldDescriptor(Label="action", Tag=1, Type=ColorControl.Enums.ColorLoopActionEnum),
                        ClusterObjectFieldDescriptor(Label="direction", Tag=2, Type=ColorControl.Enums.ColorLoopDirectionEnum),
                        ClusterObjectFieldDescriptor(Label="time", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="startHue", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=5, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=6, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            updateFlags: 'ColorControl.Bitmaps.UpdateFlagsBitmap' = 0
            action: 'ColorControl.Enums.ColorLoopActionEnum' = 0
            direction: 'ColorControl.Enums.ColorLoopDirectionEnum' = 0
            time: 'uint' = 0
            startHue: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class StopMoveStep(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x00000047
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=0, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=1, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class MoveColorTemperature(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x0000004B
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="moveMode", Tag=0, Type=ColorControl.Enums.MoveModeEnum),
                        ClusterObjectFieldDescriptor(Label="rate", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="colorTemperatureMinimumMireds", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="colorTemperatureMaximumMireds", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=4, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=5, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            moveMode: 'ColorControl.Enums.MoveModeEnum' = 0
            rate: 'uint' = 0
            colorTemperatureMinimumMireds: 'uint' = 0
            colorTemperatureMaximumMireds: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class StepColorTemperature(ClusterCommand):
            cluster_id: typing.ClassVar[int] = 0x00000300
            command_id: typing.ClassVar[int] = 0x0000004C
            is_client: typing.ClassVar[bool] = True
            response_type: typing.ClassVar[typing.Optional[str]] = None

            @ChipUtility.classproperty
            def descriptor(cls) -> ClusterObjectDescriptor:
                return ClusterObjectDescriptor(
                    Fields=[
                        ClusterObjectFieldDescriptor(Label="stepMode", Tag=0, Type=ColorControl.Enums.StepModeEnum),
                        ClusterObjectFieldDescriptor(Label="stepSize", Tag=1, Type=uint),
                        ClusterObjectFieldDescriptor(Label="transitionTime", Tag=2, Type=uint),
                        ClusterObjectFieldDescriptor(Label="colorTemperatureMinimumMireds", Tag=3, Type=uint),
                        ClusterObjectFieldDescriptor(Label="colorTemperatureMaximumMireds", Tag=4, Type=uint),
                        ClusterObjectFieldDescriptor(Label="optionsMask", Tag=5, Type=ColorControl.Bitmaps.OptionsBitmap),
                        ClusterObjectFieldDescriptor(Label="optionsOverride", Tag=6, Type=ColorControl.Bitmaps.OptionsBitmap),
                    ])

            stepMode: 'ColorControl.Enums.StepModeEnum' = 0
            stepSize: 'uint' = 0
            transitionTime: 'uint' = 0
            colorTemperatureMinimumMireds: 'uint' = 0
            colorTemperatureMaximumMireds: 'uint' = 0
            optionsMask: 'ColorControl.Bitmaps.OptionsBitmap' = 0
            optionsOverride: 'ColorControl.Bitmaps.OptionsBitmap' = 0

    class Attributes:
        @dataclass
        class CurrentHue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class CurrentSaturation(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class RemainingTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class CurrentX(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class CurrentY(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class DriftCompensation(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[ColorControl.Enums.DriftCompensationEnum])

            value: 'typing.Optional[ColorControl.Enums.DriftCompensationEnum]' = None

        @dataclass
        class CompensationText(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[str])

            value: 'typing.Optional[str]' = None

        @dataclass
        class ColorTemperatureMireds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=ColorControl.Enums.ColorModeEnum)

            value: 'ColorControl.Enums.ColorModeEnum' = 0

        @dataclass
        class Options(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000000F

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=ColorControl.Bitmaps.OptionsBitmap)

            value: 'ColorControl.Bitmaps.OptionsBitmap' = 0

        @dataclass
        class NumberOfPrimaries(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[Nullable, uint])

            value: 'typing.Union[Nullable, uint]' = NullValue

        @dataclass
        class Primary1X(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary1Y(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary1Intensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Primary2X(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary2Y(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary2Intensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000017

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Primary3X(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000019

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary3Y(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary3Intensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000001B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Primary4X(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000020

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary4Y(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary4Intensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Primary5X(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary5Y(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000025

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary5Intensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000026

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class Primary6X(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000028

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary6Y(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000029

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class Primary6Intensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000002A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class WhitePointX(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000030

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class WhitePointY(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000031

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointRx(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000032

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointRy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000033

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointRIntensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000034

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ColorPointGx(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000036

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointGy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000037

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointGIntensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00000038

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class ColorPointBx(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointBy(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorPointBIntensity(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000003C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class EnhancedCurrentHue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class EnhancedColorMode(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=ColorControl.Enums.EnhancedColorModeEnum)

            value: 'ColorControl.Enums.EnhancedColorModeEnum' = 0

        @dataclass
        class ColorLoopActive(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[Globals.Enums.enum8])

            value: 'typing.Optional[Globals.Enums.enum8]' = None

        @dataclass
        class ColorLoopDirection(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[ColorControl.Enums.ColorLoopDirectionEnum])

            value: 'typing.Optional[ColorControl.Enums.ColorLoopDirectionEnum]' = None

        @dataclass
        class ColorLoopTime(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004004

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorLoopStartEnhancedHue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004005

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorLoopStoredEnhancedHue(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorCapabilities(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000400A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=Globals.Bitmaps.map16)

            value: 'Globals.Bitmaps.map16' = 0

        @dataclass
        class ColorTempPhysicalMinMireds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000400B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class ColorTempPhysicalMaxMireds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000400C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class CoupleColorTempToLevelMinMireds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000400D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Optional[uint])

            value: 'typing.Optional[uint]' = None

        @dataclass
        class StartUpColorTemperatureMireds(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x00004010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=typing.Union[None, Nullable, uint])

            value: 'typing.Union[None, Nullable, uint]' = None

        @dataclass
        class GeneratedCommandList(ClusterAttributeDescriptor):
            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                return 0x00000300

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
                return 0x00000300

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
                return 0x00000300

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
                return 0x00000300

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
                return 0x00000300

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                return 0x0000FFFD

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                return ClusterObjectFieldDescriptor(Type=uint)

            value: 'uint' = 0
