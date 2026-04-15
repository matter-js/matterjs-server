"""Custom (vendor-specific) cluster re-exports (auto-generated, DO NOT edit)."""

from chip.clusters.cluster_defs.DraftElectricalMeasurementCluster import DraftElectricalMeasurementCluster
from chip.clusters.cluster_defs.EveCluster import EveCluster
from chip.clusters.cluster_defs.HeimanCluster import HeimanCluster
from chip.clusters.cluster_defs.InovelliCluster import InovelliCluster
from chip.clusters.cluster_defs.NeoCluster import NeoCluster
from chip.clusters.cluster_defs.ThirdRealityMeteringCluster import ThirdRealityMeteringCluster

ALL_CUSTOM_CLUSTERS: dict = {
    DraftElectricalMeasurementCluster.id: DraftElectricalMeasurementCluster,
    EveCluster.id: EveCluster,
    HeimanCluster.id: HeimanCluster,
    InovelliCluster.id: InovelliCluster,
    NeoCluster.id: NeoCluster,
    ThirdRealityMeteringCluster.id: ThirdRealityMeteringCluster,
}

__all__ = [
    "ALL_CUSTOM_CLUSTERS",
    "DraftElectricalMeasurementCluster",
    "EveCluster",
    "HeimanCluster",
    "InovelliCluster",
    "NeoCluster",
    "ThirdRealityMeteringCluster",
]
