"""Definitions for custom (vendor specific) Matter clusters."""

from dataclasses import dataclass
from typing import ClassVar

from chip import ChipUtility
from chip.clusters.ClusterObjects import (
    Cluster,
    ClusterAttributeDescriptor,
    ClusterObjectDescriptor,
    ClusterObjectFieldDescriptor,
)
from chip.tlv import float32, uint


# pylint: disable=invalid-name,arguments-renamed,no-self-argument
# mypy: ignore_errors=true


ALL_CUSTOM_CLUSTERS: dict[int, Cluster] = {}
ALL_CUSTOM_ATTRIBUTES: dict[int, dict[int, ClusterAttributeDescriptor]] = {}


@dataclass
class CustomClusterMixin:
    """Base model for a vendor specific custom cluster."""

    id: ClassVar[int]  # cluster id

    def __init_subclass__(cls: Cluster, *args, **kwargs) -> None:
        """Register a subclass."""
        super().__init_subclass__(*args, **kwargs)
        ALL_CUSTOM_CLUSTERS[cls.id] = cls


@dataclass
class CustomClusterAttributeMixin:
    """Base model for a vendor specific custom cluster attribute."""

    def __init_subclass__(cls: ClusterAttributeDescriptor, *args, **kwargs) -> None:
        """Register a subclass."""
        super().__init_subclass__(*args, **kwargs)
        if cls.cluster_id not in ALL_CUSTOM_ATTRIBUTES:
            ALL_CUSTOM_ATTRIBUTES[cls.cluster_id] = {}
        ALL_CUSTOM_ATTRIBUTES[cls.cluster_id][cls.attribute_id] = cls


@dataclass
class EveCluster(Cluster, CustomClusterMixin):
    """Custom (vendor-specific) cluster for Eve - Vendor ID 4874 (0x130a)."""

    id: ClassVar[int] = 0x130AFC01

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        """Return descriptor for this cluster."""
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(
                    Label="getConfig", Tag=0x130A0000, Type=bytes
                ),
                ClusterObjectFieldDescriptor(
                    Label="setConfig", Tag=0x130A0001, Type=bytes
                ),
                ClusterObjectFieldDescriptor(
                    Label="loggingMetadata", Tag=0x130A0002, Type=bytes
                ),
                ClusterObjectFieldDescriptor(
                    Label="loggingData", Tag=0x130A0003, Type=bytes
                ),
                ClusterObjectFieldDescriptor(
                    Label="timesOpened", Tag=0x130A0006, Type=int
                ),
                ClusterObjectFieldDescriptor(
                    Label="lastEventTime", Tag=0x130A0007, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="watt", Tag=0x130A000A, Type=float32
                ),
                ClusterObjectFieldDescriptor(
                    Label="wattAccumulated", Tag=0x130A000B, Type=float32
                ),
                ClusterObjectFieldDescriptor(
                    Label="statusFault", Tag=0x130A000C, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="wattAccumulatedControlPoint", Tag=0x130A000E, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="voltage", Tag=0x130A0008, Type=float32
                ),
                ClusterObjectFieldDescriptor(
                    Label="current", Tag=0x130A0009, Type=float32
                ),
                ClusterObjectFieldDescriptor(
                    Label="obstructionDetected", Tag=0x130A0010, Type=bool
                ),
                ClusterObjectFieldDescriptor(
                    Label="childLock", Tag=0x130A0011, Type=bool
                ),
                ClusterObjectFieldDescriptor(
                    Label="rloc16", Tag=0x130A0012, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="altitude", Tag=0x130A0013, Type=float32
                ),
                ClusterObjectFieldDescriptor(
                    Label="pressure", Tag=0x130A0014, Type=float32
                ),
                ClusterObjectFieldDescriptor(
                    Label="weatherTrend", Tag=0x130A0015, Type=int
                ),
                ClusterObjectFieldDescriptor(
                    Label="valvePosition", Tag=0x130A0018, Type=int
                ),
                ClusterObjectFieldDescriptor(
                    Label="motionSensitivity", Tag=0x130A000D, Type=uint
                ),
            ]
        )

    getConfig: bytes | None = None
    setConfig: bytes | None = None
    loggingMetadata: bytes | None = None
    loggingData: bytes | None = None
    timesOpened: int | None = None
    lastEventTime: uint | None = None
    watt: float32 | None = None
    wattAccumulated: float32 | None = None
    statusFault: uint | None = None
    wattAccumulatedControlPoint: uint | None = None
    voltage: float32 | None = None
    current: float32 | None = None
    altitude: float32 | None = None
    pressure: float32 | None = None
    weatherTrend: int | None = None
    valvePosition: int | None = None
    motionSensitivity: int | None = None
    obstructionDetected: bool | None = None
    childLock: bool | None = None
    rloc16: uint | None = None

    class Attributes:
        """Attributes for the Eve Cluster."""

        @dataclass
        class GetConfig(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """GetConfig Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bytes)

            value: bytes = b""

        @dataclass
        class SetConfig(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """SetConfig Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0001

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bytes)

            value: bytes = b""

        @dataclass
        class LoggingMetadata(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """LoggingMetadata Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0002

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bytes)

            value: bytes = b""

        @dataclass
        class LoggingData(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """LoggingData Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0003

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bytes)

            value: bytes = b""

        @dataclass
        class TimesOpened(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """TimesOpened Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0006

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=int)

            value: int = 0

        @dataclass
        class LastEventTime(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """LastEventTime Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0007

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Watt(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Watt Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A000A

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=float32)

            value: float32 = 0

        @dataclass
        class WattAccumulated(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """WattAccumulated Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A000B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=float32)

            value: float32 = 0

        @dataclass
        class StatusFault(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """StatusFault Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A000C

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class WattAccumulatedControlPoint(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """wattAccumulatedControlPoint Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A000E

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Voltage(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Voltage Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0008

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=float32)

            value: float32 = 0

        @dataclass
        class Current(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Current Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0009

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=float32)

            value: float32 = 0

        @dataclass
        class ObstructionDetected(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """ObstructionDetected Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bool)

            value: bool = False

        @dataclass
        class ChildLock(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """ChildLock Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bool)

            value: bool = False

        @dataclass
        class Rloc16(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Rloc16 Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Altitude(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Altitude Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=float32)

            value: float32 = 0

        @dataclass
        class Pressure(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Pressure Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=float32)

            value: float32 = 0

        @dataclass
        class WeatherTrend(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """WeatherTrend Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=int)

            value: int = 0

        @dataclass
        class ValvePosition(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """ValvePosition Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A0018

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=int)

            value: int = 0

        @dataclass
        class MotionSensitivity(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """MotionSensitivity Attribute within the Eve Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130AFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x130A000D

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: int = 0


@dataclass
class InovelliCluster(Cluster, CustomClusterMixin):
    """Custom (vendor-specific) cluster for Inovelli - Vendor ID 4961 (0x1361)."""

    id: ClassVar[int] = 0x122FFC31

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        """Return descriptor for this cluster."""
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(
                    Label="ledIndicatorIntensityOn", Tag=0x122F0061, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="ledIndicatorIntensityOff", Tag=0x122F0062, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="clearNotificationWithConfigDoubleTap",
                    Tag=0x122F0106,
                    Type=bool,
                ),
            ]
        )

    ledIndicatorIntensityOn: uint | None = None
    ledIndicatorIntensityOff: uint | None = None
    clearNotificationWithConfigDoubleTap: bool | None = None

    class Attributes:
        """Attributes for the Inovelli Cluster."""

        @dataclass
        class LEDIndicatorIntensityOn(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """LEDIndicatorIntensityOn Attribute within the Inovelli Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x122FFC31

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x122F0061

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class LEDIndicatorIntensityOff(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """LEDIndicatorIntensityOff Attribute within the Inovelli Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x122FFC31

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x122F0062

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class ClearNotificationWithConfigDoubleTap(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """ClearNotificationWithConfigDoubleTap Attribute within the Inovelli Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x122FFC31

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x122F0106

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=bool)

            value: bool = False


@dataclass
class NeoCluster(Cluster, CustomClusterMixin):
    """Custom (vendor-specific) cluster for Neo - Vendor ID 4991 (0x137F)."""

    id: ClassVar[int] = 0x00125DFC11

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        """Return descriptor for this cluster."""
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(
                    Label="wattAccumulated", Tag=0x00125D0021, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="watt", Tag=0x00125D0023, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="current", Tag=0x00125D0022, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="voltage", Tag=0x00125D0024, Type=uint
                ),
            ]
        )

    watt: uint | None = None
    wattAccumulated: uint | None = None
    voltage: uint | None = None
    current: uint | None = None

    class Attributes:
        """Attributes for the Neo Cluster."""

        @dataclass
        class Watt(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Watt Attribute within the Neo Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00125DFC11

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00125D0023

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class WattAccumulated(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """WattAccumulated Attribute within the Neo Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00125DFC11

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00125D0021

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Voltage(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Voltage Attribute within the Neo Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00125DFC11

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00125D0024

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Current(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Current Attribute within the Neo Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00125DFC11

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00125D0022

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0


@dataclass
class HeimanCluster(Cluster, CustomClusterMixin):
    """Custom (vendor-specific) cluster for Heiman - Vendor ID 4619 (0x120BFC01)."""

    id: ClassVar[int] = 0x120BFC01

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        """Return descriptor for this cluster."""
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(
                    Label="tamperAlarm", Tag=0x0010, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="preheatingState", Tag=0x0011, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="noDisturbingState", Tag=0x0012, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="sensorType", Tag=0x0013, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="sirenActive", Tag=0x0014, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="alarmMute", Tag=0x0015, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="lowPowerMode", Tag=0x0016, Type=uint
                ),
            ]
        )

    tamperAlarm: uint | None = None
    preheatingState: uint | None = None
    noDisturbingState: uint | None = None
    sensorType: uint | None = None
    sirenActive: uint | None = None
    alarmMute: uint | None = None
    lowPowerMode: uint | None = None

    class Attributes:
        """Attributes for the Heiman Cluster."""

        @dataclass
        class TamperAlarm(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """TamperAlarm Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0010

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class PreheatingState(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """PreheatingState Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0011

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class NoDisturbingState(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """NoDisturbingState Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0012

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class SensorType(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """SensorType Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0013

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class SirenActive(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """SirenActive Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0014

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AlarmMute(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """AlarmMute Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0015

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class LowPowerMode(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """LowPowerMode Attribute within the Heiman Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x120BFC01

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0016

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0


@dataclass
class ThirdRealityMeteringCluster(Cluster, CustomClusterMixin):
    """Custom (vendor-specific) PowerMetering cluster for ThirdReality."""

    id: ClassVar[int] = 0x130DFC02

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        """Return descriptor for this cluster."""
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(
                    Label="currentSummationDelivered", Tag=0x0000, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="instantaneousDemand", Tag=0x0400, Type=uint
                ),
                ClusterObjectFieldDescriptor(Label="multiplier", Tag=0x0301, Type=uint),
                ClusterObjectFieldDescriptor(Label="divisor", Tag=0x0302, Type=uint),
            ]
        )

    currentSummationDelivered: uint | None = None
    instantaneousDemand: uint | None = None
    multiplier: uint = 1
    divisor: uint = 1

    class Attributes:
        """Attributes for the custom Cluster."""

        @dataclass
        class CurrentSummationDelivered(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """CurrentSummationDelivered represents the most recent summed value of Energy consumed in the premise.

            CurrentSummationDelivered is updated continuously as new measurements are made.
            This attribute is Read only.
            Value is set to zero when leave command is received (beginning version 2.6.15),
            or local factory reset(10s) is performed on the device..
            """

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130DFC02

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0000

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class Divisor(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Divisor Attribute within the ThirdRealityMeteringCluster Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130DFC02

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0302

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 1

        @dataclass
        class Multiplier(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """Multiplier Attribute within the ThirdRealityMeteringCluster Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130DFC02

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0301

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 1

        @dataclass
        class InstantaneousDemand(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """
            InstantaneousDemand represents the current Demand of Energy delivered at the premise.

            Device is able measure only positive values indicate Demand delivered to the premise.
            InstantaneousDemand is updated continuously as new measurements are made.
            The frequency of updates to this field is specific to the metering device,
            but should be within the range of once every second to once every 5 seconds.
            The same multiplier and divisor values used for Current Summation Delivered (Energy) will be used.
            If connected load is below 1W, this attribute is set to 0 and no accumulation of energy is done.
            """

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x130DFC02

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0400

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0


@dataclass
class DraftElectricalMeasurementCluster(Cluster, CustomClusterMixin):
    """Custom ElectricalMetering cluster from Matter 1.0 draft specification."""

    id: ClassVar[int] = 0x00000B04

    @ChipUtility.classproperty
    def descriptor(cls) -> ClusterObjectDescriptor:
        """Return descriptor for this cluster."""
        return ClusterObjectDescriptor(
            Fields=[
                ClusterObjectFieldDescriptor(
                    Label="rmsVoltage", Tag=0x00000505, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="rmsCurrent", Tag=0x00000508, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="activePower", Tag=0x0000050B, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="acVoltageMultiplier", Tag=0x00000600, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="acVoltageDivisor", Tag=0x00000601, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="acCurrentMultiplier", Tag=0x00000602, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="acCurrentDivisor", Tag=0x00000603, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="acPowerMultiplier", Tag=0x00000604, Type=uint
                ),
                ClusterObjectFieldDescriptor(
                    Label="acPowerDivisor", Tag=0x00000605, Type=uint
                ),
            ]
        )

    rmsVoltage: uint | None = None
    rmsCurrent: uint | None = None
    activePower: uint | None = None
    acVoltageMultiplier: uint | None = None
    acVoltageDivisor: uint | None = None
    acCurrentMultiplier: uint | None = None
    acCurrentDivisor: uint | None = None
    acPowerMultiplier: uint | None = None
    acPowerDivisor: uint | None = None

    class Attributes:
        """Attributes for the custom Cluster."""

        @dataclass
        class RmsVoltage(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """RmsVoltage Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000505

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class RmsCurrent(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """RmsCurrent Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000508

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class ActivePower(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """ActivePower Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x0000050B

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AcVoltageMultiplier(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """AcVoltageMultiplier Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000600

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AcVoltageDivisor(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """AcVoltageDivisor Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000601

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AcCurrentMultiplier(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """AcCurrentMultiplier Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000602

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AcCurrentDivisor(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """AcCurrentDivisor Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000603

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AcPowerMultiplier(
            ClusterAttributeDescriptor, CustomClusterAttributeMixin
        ):
            """AcPowerMultiplier Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000604

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0

        @dataclass
        class AcPowerDivisor(ClusterAttributeDescriptor, CustomClusterAttributeMixin):
            """AcPowerDivisor Attribute within the DraftElectricalMeasurement Cluster."""

            @ChipUtility.classproperty
            def cluster_id(cls) -> int:
                """Return cluster id."""
                return 0x00000B04

            @ChipUtility.classproperty
            def attribute_id(cls) -> int:
                """Return attribute id."""
                return 0x00000605

            @ChipUtility.classproperty
            def attribute_type(cls) -> ClusterObjectFieldDescriptor:
                """Return attribute type."""
                return ClusterObjectFieldDescriptor(Type=uint)

            value: uint = 0
