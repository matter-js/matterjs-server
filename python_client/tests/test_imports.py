"""Smoke tests verifying all HA integration imports resolve."""

from typing import Any


def test_client_imports():
    """All client module imports used by HA integration must resolve."""
    from matter_server.client import MatterClient
    from matter_server.client.exceptions import CannotConnect, InvalidServerVersion

    assert MatterClient is not None
    assert CannotConnect is not None
    assert InvalidServerVersion is not None


def test_client_model_imports():
    """All client model imports used by HA integration must resolve."""
    from matter_server.client.models import device_types
    from matter_server.client.models.device_types import BridgedNode, DeviceType
    from matter_server.client.models.node import MatterEndpoint, MatterNode

    assert device_types is not None
    assert BridgedNode is not None
    assert DeviceType is not None
    assert MatterEndpoint is not None
    assert MatterNode is not None


def test_common_model_imports():
    """All common model imports used by HA integration must resolve."""
    from matter_server.common.errors import (
        MatterError,
        NodeNotExists,
        UpdateCheckError,
        UpdateError,
    )
    from matter_server.common.models import (
        EventType,
        MatterSoftwareVersion,
        ServerInfoMessage,
        UpdateSource,
    )

    assert EventType is not None
    assert ServerInfoMessage is not None
    assert MatterSoftwareVersion is not None
    assert UpdateSource is not None
    assert MatterError is not None
    assert NodeNotExists is not None
    assert UpdateCheckError is not None
    assert UpdateError is not None


def test_helper_imports():
    """All helper imports used by HA integration must resolve."""
    from matter_server.common.helpers.util import (
        create_attribute_path,
        create_attribute_path_from_attribute,
        dataclass_to_dict,
        parse_attribute_path,
    )

    assert create_attribute_path is not None
    assert create_attribute_path_from_attribute is not None
    assert dataclass_to_dict is not None
    assert parse_attribute_path is not None


def test_custom_cluster_imports():
    """All custom cluster imports used by HA integration must resolve."""
    from matter_server.common.custom_clusters import (
        DraftElectricalMeasurementCluster,
        EveCluster,
        HeimanCluster,
        InovelliCluster,
        NeoCluster,
        ThirdRealityMeteringCluster,
    )

    assert EveCluster is not None
    assert HeimanCluster is not None
    assert InovelliCluster is not None
    assert NeoCluster is not None
    assert ThirdRealityMeteringCluster is not None
    assert DraftElectricalMeasurementCluster is not None


def test_eve_new_attributes_exist():
    """New Eve attributes added for JS server must be accessible."""
    from matter_server.common.custom_clusters import EveCluster

    attrs = EveCluster.Attributes
    # New attributes
    assert hasattr(attrs, "GetConfig")
    assert hasattr(attrs, "SetConfig")
    assert hasattr(attrs, "LoggingMetadata")
    assert hasattr(attrs, "LoggingData")
    assert hasattr(attrs, "LastEventTime")
    assert hasattr(attrs, "StatusFault")
    assert hasattr(attrs, "ChildLock")
    assert hasattr(attrs, "Rloc16")
    # Existing attributes still present
    assert hasattr(attrs, "Watt")
    assert hasattr(attrs, "Voltage")
    assert hasattr(attrs, "Current")


def test_heiman_short_attribute_ids():
    """Heiman cluster must use short attribute IDs matching JS server."""
    from matter_server.common.custom_clusters import HeimanCluster

    assert HeimanCluster.Attributes.TamperAlarm.attribute_id == 0x0010
    assert HeimanCluster.Attributes.PreheatingState.attribute_id == 0x0011
    assert HeimanCluster.Attributes.NoDisturbingState.attribute_id == 0x0012
    assert HeimanCluster.Attributes.SensorType.attribute_id == 0x0013
    assert HeimanCluster.Attributes.SirenActive.attribute_id == 0x0014
    assert HeimanCluster.Attributes.AlarmMute.attribute_id == 0x0015
    assert HeimanCluster.Attributes.LowPowerMode.attribute_id == 0x0016


def test_polling_removed():
    """Polling infrastructure must not exist."""
    import matter_server.common.custom_clusters as cc

    assert not hasattr(cc, "should_poll_eve_energy")
    assert not hasattr(cc, "check_polled_attributes")
    assert not hasattr(cc, "VENDOR_ID_EVE")


def test_chip_objects_type_exports() -> None:
    """chip.clusters.Objects must export primitive types used by the HA integration."""
    from chip.clusters.Objects import Nullable, NullValue, float32, uint

    assert issubclass(uint, int), "uint must be a subclass of int"
    assert issubclass(float32, float), "float32 must be a subclass of float"
    assert issubclass(Nullable, object), "Nullable must be a class"
    assert isinstance(NullValue, Nullable), "NullValue must be an instance of Nullable"
    assert uint(42) == 42, "uint must be constructable from a positive int"


def test_administrator_commissioning_timed_invoke() -> None:
    """OpenCommissioningWindow must require timed invoke (security requirement)."""
    from chip.clusters.objects.AdministratorCommissioning import AdministratorCommissioning

    cls = AdministratorCommissioning.Commands.OpenCommissioningWindow
    assert hasattr(cls, "must_use_timed_invoke"), "OpenCommissioningWindow must have must_use_timed_invoke"
    assert cls.must_use_timed_invoke is True, "OpenCommissioningWindow.must_use_timed_invoke must return True"


def _assert_mode_option_struct_fields(struct: Any, cluster_name: str) -> None:
    # Use __dataclass_fields__ because modeTags uses default_factory and
    # therefore has no class-level attribute (hasattr returns False for it).
    fields = set(struct.__dataclass_fields__.keys())
    assert "label"    in fields, f"{cluster_name}.Structs.ModeOptionStruct missing 'label'"
    assert "mode"     in fields, f"{cluster_name}.Structs.ModeOptionStruct missing 'mode'"
    assert "modeTags" in fields, f"{cluster_name}.Structs.ModeOptionStruct missing 'modeTags'"


def test_mode_option_struct_has_fields() -> None:
    """ModeOptionStruct must have label, mode, modeTags fields in all mode clusters."""
    from chip.clusters.objects.DishwasherMode import DishwasherMode
    from chip.clusters.objects.OvenMode import OvenMode

    _assert_mode_option_struct_fields(DishwasherMode.Structs.ModeOptionStruct, "DishwasherMode")
    _assert_mode_option_struct_fields(OvenMode.Structs.ModeOptionStruct, "OvenMode")
