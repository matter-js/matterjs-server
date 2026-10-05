"""Custom (vendor-specific) cluster re-exports (auto-generated, DO NOT edit)."""

from chip.clusters.cluster_defs.AqaraAmbientSensingConfigurationCluster import AqaraAmbientSensingConfigurationCluster
from chip.clusters.cluster_defs.AqaraOccupantLocationCluster import AqaraOccupantLocationCluster
from chip.clusters.cluster_defs.AqaraRadarSensingUnionCluster import AqaraRadarSensingUnionCluster
from chip.clusters.cluster_defs.DraftElectricalMeasurementCluster import DraftElectricalMeasurementCluster
from chip.clusters.cluster_defs.EveCluster import EveCluster
from chip.clusters.cluster_defs.HeimanCluster import HeimanCluster
from chip.clusters.cluster_defs.InovelliCluster import InovelliCluster
from chip.clusters.cluster_defs.NeoCluster import NeoCluster
from chip.clusters.cluster_defs.TclDehumidifierCluster import TclDehumidifierCluster
from chip.clusters.cluster_defs.ThirdRealityMeteringCluster import ThirdRealityMeteringCluster
from chip.clusters.cluster_defs.WagoCluster import WagoCluster

ALL_CUSTOM_CLUSTERS: dict = {
    AqaraAmbientSensingConfigurationCluster.id: AqaraAmbientSensingConfigurationCluster,
    AqaraOccupantLocationCluster.id: AqaraOccupantLocationCluster,
    AqaraRadarSensingUnionCluster.id: AqaraRadarSensingUnionCluster,
    DraftElectricalMeasurementCluster.id: DraftElectricalMeasurementCluster,
    EveCluster.id: EveCluster,
    HeimanCluster.id: HeimanCluster,
    InovelliCluster.id: InovelliCluster,
    NeoCluster.id: NeoCluster,
    TclDehumidifierCluster.id: TclDehumidifierCluster,
    ThirdRealityMeteringCluster.id: ThirdRealityMeteringCluster,
    WagoCluster.id: WagoCluster,
}

__all__ = [
    "ALL_CUSTOM_CLUSTERS",
    "AqaraAmbientSensingConfigurationCluster",
    "AqaraOccupantLocationCluster",
    "AqaraRadarSensingUnionCluster",
    "DraftElectricalMeasurementCluster",
    "EveCluster",
    "HeimanCluster",
    "InovelliCluster",
    "NeoCluster",
    "TclDehumidifierCluster",
    "ThirdRealityMeteringCluster",
    "WagoCluster",
]
