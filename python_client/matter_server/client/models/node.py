"""Matter node."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
import logging
from typing import TYPE_CHECKING, Any, TypeVar, cast

from chip.clusters import Objects as Clusters
from chip.clusters.ClusterObjects import ALL_ATTRIBUTES, ALL_CLUSTERS
from matter_server.common.helpers.util import (
    create_attribute_path,
    parse_attribute_path,
    parse_value,
)

from .device_types import (
    ALL_TYPES as DEVICE_TYPES,
    Aggregator,
    BridgedNode,
    DeviceType,
    RootNode,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from matter_server.common.models import MatterNodeData

LOGGER = logging.getLogger(__name__)

# the Matter specification places the Root Node on endpoint 0 of every node
ROOT_ENDPOINT_ID = 0

# pylint: disable=invalid-name
_CLUSTER_T = TypeVar("_CLUSTER_T", bound=Clusters.Cluster)
_ATTRIBUTE_T = TypeVar("_ATTRIBUTE_T", bound=Clusters.ClusterAttributeDescriptor)
# pylint: enable=invalid-name


def get_object_params(
    descriptor: Clusters.ClusterObjectDescriptor, object_id: int
) -> tuple[str, type]:
    """Parse label/key and type for an object from the descriptors, given the raw object id."""
    for desc in descriptor.Fields:
        if desc.Tag == object_id:
            return (desc.Label, desc.Type)
    raise KeyError(f"No descriptor found for object {object_id}")


def _reaches(start_id: int, target_id: int, parents: Mapping[int, int]) -> bool:
    """Return whether walking up the parent chain from an endpoint arrives at another."""
    seen: set[int] = set()
    current: int | None = start_id
    while current is not None and current not in seen:
        if current == target_id:
            return True
        seen.add(current)
        current = parents.get(current)
    return False


@dataclass
class MatterFabricData:
    """Data about a Matter fabric."""

    fabric_id: int
    vendor_id: int
    fabric_index: int
    fabric_label: str | None = None
    vendor_name: str | None = None


class MatterEndpoint:
    """Representation of a Matter Endpoint."""

    def __init__(
        self,
        endpoint_id: int,
        attributes_data: dict[str, Any],
        node: MatterNode,
    ) -> None:
        """Initialize MatterEndpoint."""
        self.node = node
        self.endpoint_id = endpoint_id
        self.clusters: dict[int, Clusters.Cluster] = {}
        self.device_types: set[type[DeviceType]] = set()
        self.update(attributes_data)

    @property
    def is_bridged_device(self) -> bool:
        """Return if this endpoint represents a Bridged device."""
        return BridgedNode in self.device_types

    @property
    def is_composed_device(self) -> bool:
        """Return if this endpoint belongs to a composed device."""
        return self.node.get_compose_parent(self.endpoint_id) is not None

    @property
    def device_info(
        self,
    ) -> Clusters.BasicInformation | Clusters.BridgedDeviceBasicInformation | None:
        """
        Return device info.

        Returns the BridgedDeviceBasicInformation of the Bridged Node this endpoint is or is a part
        of, else the BasicInformation of the Node itself. It is None when that Bridged Node reports
        no BridgedDeviceBasicInformation, because the info of the bridge or of the Aggregator above
        it belongs to a different device.
        """
        endpoint = self
        seen: set[int] = set()
        while endpoint.endpoint_id not in seen:
            seen.add(endpoint.endpoint_id)
            if endpoint.is_bridged_device:
                return endpoint.get_cluster(Clusters.BridgedDeviceBasicInformation)
            parent = endpoint.node.get_compose_parent(endpoint.endpoint_id)
            if parent is None:
                break
            endpoint = parent
        return self.node.device_info

    def has_cluster(self, cluster: type[_CLUSTER_T] | int) -> bool:
        """
        Check if endpoint has a specific cluster.

        Provide the cluster to lookup either as the class/type or the id.
        """
        if isinstance(cluster, type):
            return cluster.id in self.clusters
        return cluster in self.clusters

    def get_cluster(self, cluster: type[_CLUSTER_T] | int) -> _CLUSTER_T | None:
        """
        Get a full Cluster object containing all attributes.

        Provide the cluster to lookup either as the class/type or the id.
        Return None if the Cluster is not present on the node.
        """
        if isinstance(cluster, type):
            return self.clusters.get(cluster.id)
        return self.clusters.get(cluster)

    def get_attribute_value(
        self,
        cluster: type[_CLUSTER_T] | int | None,
        attribute: int | type[_ATTRIBUTE_T],
    ) -> Any:
        """
        Return Matter Cluster Attribute object for given parameters.

        Either supply a cluster id and attribute id or omit cluster
        and supply the Attribute class/type.
        """
        if cluster is None:
            # allow sending None for Cluster to auto resolve it from the Attribute
            if isinstance(attribute, int):
                raise TypeError("Attribute can not be integer if Cluster is omitted")
            cluster = attribute.cluster_id
        # get cluster first, grab value from cluster instance next
        if cluster_obj := self.get_cluster(cluster):
            if isinstance(attribute, type):
                attribute_name, _ = get_object_params(
                    cluster_obj.descriptor, attribute.attribute_id
                )
                return getattr(cluster_obj, attribute_name)
            # actual value is just a class attribute on the cluster instance
            # NOTE: do not use the value on the ClusterAttribute
            # instance itself as that is not used!
            attribute_name, _ = get_object_params(cluster_obj.descriptor, attribute)
            return getattr(
                cluster_obj,
                attribute_name,
            )
        return None

    def has_attribute(
        self,
        cluster: type[_CLUSTER_T] | int | None,
        attribute: int | type[_ATTRIBUTE_T],
    ) -> bool:
        """
        Perform a quick check if the endpoint has a specific attribute.

        Either supply a cluster id and attribute id or omit cluster
        and supply the Attribute class/type.
        """
        if cluster is None:
            if isinstance(attribute, int):
                raise TypeError("Attribute can not be integer if Cluster is omitted")
            # allow sending None for Cluster to auto resolve it from the Attribute
            cluster = attribute.cluster_id
        cluster_id = cluster if isinstance(cluster, int) else cluster.id
        attribute_id = (
            attribute if isinstance(attribute, int) else attribute.attribute_id
        )
        # the fastest way to check this is just by checking the AttributePath in the raw data...
        attr_path = create_attribute_path(self.endpoint_id, cluster_id, attribute_id)
        return attr_path in self.node.node_data.attributes

    def set_attribute_value(self, attribute_path: str, attribute_value: Any) -> None:
        """
        Set the value of a Cluster Attribute.

        May only be called by logic that received data from the server.
        Do not modify the data directly from a consumer.
        """
        _, cluster_id, attribute_id = parse_attribute_path(attribute_path)
        if (
            cluster_id not in ALL_CLUSTERS
            or cluster_id not in ALL_ATTRIBUTES
            or attribute_id not in ALL_ATTRIBUTES[cluster_id]
        ):
            # guard for unknown/custom clusters/attributes
            return
        assert cluster_id is not None  # for mypy
        assert attribute_id is not None  # for mypy
        cluster_class: type[Clusters.Cluster] = ALL_CLUSTERS[cluster_id]
        if cluster_id in self.clusters:
            cluster_instance = self.clusters[cluster_id]
        else:
            cluster_instance = cluster_class()
            self.clusters[cluster_id] = cluster_instance

        # unpack cluster attribute, using the descriptor
        attribute_class: type[Clusters.ClusterAttributeDescriptor] = ALL_ATTRIBUTES[
            cluster_id
        ][attribute_id]
        attribute_name, attribute_type = get_object_params(
            cluster_class.descriptor, attribute_id
        )

        # we only set the value at cluster instance level and we leave
        # the underlying Attributes classproperty alone
        attribute_value = parse_value(
            attribute_name, attribute_value, attribute_type, attribute_class().value
        )
        setattr(cluster_instance, attribute_name, attribute_value)

    def update(self, attributes_data: dict[str, Any]) -> None:
        """Update MatterEndpoint from (endpoint-specific) raw Attributes data."""
        # a snapshot carries the complete state of the endpoint, never a delta
        self.clusters = {}
        # unwrap cluster and clusterattributes from raw node data attributes
        for attribute_path, attribute_value in attributes_data.items():
            self.set_attribute_value(attribute_path, attribute_value)
        # a snapshot without the DeviceTypeList says nothing about the device types, so the previous ones stay
        if f"{self.endpoint_id}/29/0" in attributes_data and (cluster := self.get_cluster(Clusters.Descriptor)):
            self.device_types = set()
            for dev_info in cluster.deviceTypeList:
                device_type = DEVICE_TYPES.get(dev_info.deviceType)
                if device_type is None:
                    LOGGER.debug("Found unknown device type %s", dev_info)
                    continue
                self.device_types.add(device_type)

    def __repr__(self) -> str:
        """Return the representation."""
        return f"<MatterEndpoint {self.endpoint_id} (node {self.node.node_id})>"


class MatterNode:
    """Representation of a Matter Node."""

    def __init__(self, node_data: MatterNodeData) -> None:
        """Initialize MatterNode from MatterNodeData."""
        self.endpoints: dict[int, MatterEndpoint] = {}
        self._composed_endpoints: dict[int, int] = {}
        self._bridge_parents: dict[int, int] = {}
        self._snapshot_endpoint_ids: set[int] = set()
        self._reported_missing_bridged_info: set[int] = set()
        self.update(node_data)

    @property
    def node_id(self) -> int:
        """Return Node ID."""
        return self.node_data.node_id

    @property
    def name(self) -> str | None:
        """Return friendly name for this node."""
        if info := self.device_info:
            return cast(str, info.nodeLabel)
        return None

    @property
    def available(self) -> bool:
        """Return availability of the node."""
        return self.node_data.available

    @property
    def device_info(self) -> Clusters.BasicInformation | None:
        """
        Return device info for this Node.

        Returns BasicInformation from the Node itself (endpoint 0), or None while the node has not
        reported it.
        """
        return self.get_cluster(0, Clusters.BasicInformation)

    @property
    def is_bridge_device(self) -> bool:
        """Return if this Node is a Bridge/Aggregator device."""
        return self.node_data.is_bridge

    def get_attribute_value(
        self,
        endpoint: int,
        cluster: type[_CLUSTER_T] | int | None,
        attribute: int | type[_ATTRIBUTE_T],
    ) -> Any:
        """Return Matter Cluster Attribute value for given parameters."""
        return self.endpoints[endpoint].get_attribute_value(cluster, attribute)

    def has_cluster(
        self, cluster: type[_CLUSTER_T] | int, endpoint: int | None = None
    ) -> bool:
        """Check if node has a specific cluster on any of the endpoints."""
        return any(
            x
            for x in self.endpoints.values()
            if x.has_cluster(cluster)
            and (endpoint is None or x.endpoint_id == endpoint)
        )

    def get_cluster(
        self, endpoint: int, cluster: type[_CLUSTER_T] | int
    ) -> _CLUSTER_T | None:
        """
        Get a Cluster object containing all attributes.

        Returns None is the Cluster is not present on the node.
        """
        if (endpoint_obj := self.endpoints.get(endpoint)) is None:
            return None
        return endpoint_obj.get_cluster(cluster)

    def get_compose_parent(self, endpoint_id: int) -> MatterEndpoint | None:
        """Return endpoint of parent if the endpoint belongs to a Composed device."""
        if (parent_id := self._composed_endpoints.get(endpoint_id)) is None:
            return None
        return self.endpoints.get(parent_id)

    def get_compose_child_ids(self, endpoint_id: int) -> tuple[int, ...]:
        """Return endpoint IDs of any child if the endpoint represents a Composed device."""
        return tuple(sorted(x for x, y in self._composed_endpoints.items() if y == endpoint_id))

    def get_bridge_parent(self, endpoint_id: int) -> MatterEndpoint | None:
        """Return the Aggregator endpoint that bridges the given endpoint, if any."""
        if (parent_id := self._bridge_parents.get(endpoint_id)) is None:
            return None
        return self.endpoints.get(parent_id)

    def get_bridge_child_ids(self, endpoint_id: int) -> tuple[int, ...]:
        """Return endpoint IDs of the devices bridged by the given Aggregator endpoint."""
        return tuple(sorted(x for x, y in self._bridge_parents.items() if y == endpoint_id))

    def update(self, node_data: MatterNodeData) -> None:
        """Update MatterNode from MatterNodeData."""
        self.node_data = node_data
        # collect per endpoint data
        endpoint_data: dict[int, dict[str, Any]] = {}
        for attribute_path, attribute_data in node_data.attributes.items():
            endpoint_id = int(attribute_path.split("/")[0])
            if endpoint_id not in endpoint_data:
                endpoint_data[endpoint_id] = {}
            endpoint_data[endpoint_id][attribute_path] = attribute_data
        self._snapshot_endpoint_ids = set(endpoint_data)
        for endpoint_id, attributes_data in endpoint_data.items():
            if endpoint_id in self.endpoints:
                self.endpoints[endpoint_id].update(attributes_data)
            else:
                self.endpoints[endpoint_id] = MatterEndpoint(
                    endpoint_id=endpoint_id, attributes_data=attributes_data, node=self
                )
        self._map_endpoint_parents()

    def _remove_endpoint(self, endpoint_id: int) -> None:
        """Remove an endpoint together with its parts, and every parent relation they are in.

        This is the only way an endpoint leaves `endpoints`: a snapshot that no longer reports an
        endpoint keeps its object until the server announces the removal, because consumers look
        the endpoint up when handling that announcement. The parts of the endpoint, at any depth,
        leave with it whether or not a snapshot still reports them: their device is gone, and left
        behind they would resolve to no device when their own removal arrives. A device the
        endpoint bridged stays, without its bridge parent, until its own removal arrives.

        May only be called by logic that received data from the server.
        """
        if endpoint_id not in self.endpoints:
            return
        removed = {endpoint_id}
        pending = [endpoint_id]
        while pending:
            parent_id = pending.pop()
            for child_id, child_parent_id in self._composed_endpoints.items():
                if child_parent_id == parent_id and child_id not in removed:
                    removed.add(child_id)
                    pending.append(child_id)
        for removed_id in removed:
            del self.endpoints[removed_id]
            self._reported_missing_bridged_info.discard(removed_id)
        self._composed_endpoints = {
            child_id: parent_id for child_id, parent_id in self._composed_endpoints.items() if child_id not in removed
        }
        self._bridge_parents = {
            child_id: parent_id
            for child_id, parent_id in self._bridge_parents.items()
            if child_id not in removed and parent_id not in removed
        }

    def _map_endpoint_parents(self) -> None:
        """Resolve each endpoint to its closest parent endpoint, split by parent kind.

        An endpoint's partsList may enumerate its whole family - every descendant, not just
        the direct children - which is the pattern a bridge uses. Of the endpoints listing a
        given endpoint, the closest one is therefore the endpoint that lists none of the
        others - on contradictory lists the smaller family wins, then the lower endpoint
        number - and a parent is only accepted while the relations stay a tree.

        Only the endpoints of the last snapshot take part. A snapshot replaces the relation of an
        endpoint only where it names a parent for it: one that bridges or composes it, or the
        parent it already had, whose classification then wins. Where it names none - the endpoint
        unlisted or unreported, its parent without a Descriptor or device types, or listed only by
        endpoints that make it neither bridged nor a part - the endpoint keeps its relation until
        its own removal or that of the parent is announced, so a consumer handling the
        announcement still finds the device the endpoint is a part of. A kept relation that would
        close a cycle with a named one is dropped.
        """
        snapshot_ids = self._snapshot_endpoint_ids & self.endpoints.keys()
        families: dict[int, set[int]] = {}
        for endpoint in self.endpoints.values():
            if endpoint.endpoint_id not in snapshot_ids:
                continue
            descriptor = endpoint.get_cluster(Clusters.Descriptor)
            if descriptor is None:
                LOGGER.warning(
                    "Found endpoint without a Descriptor: Node %s, endpoint %s",
                    self.node_id,
                    endpoint.endpoint_id,
                )
                continue
            families[endpoint.endpoint_id] = {
                child_id
                for child_id in descriptor.partsList or ()
                if child_id in snapshot_ids and child_id != endpoint.endpoint_id
            }

        candidates: dict[int, set[int]] = {}
        for parent_id, family in families.items():
            for child_id in family:
                candidates.setdefault(child_id, set()).add(parent_id)

        parents: dict[int, int] = {}
        for child_id in sorted(candidates):
            parent_ids = candidates[child_id]
            for parent_id in sorted(
                parent_ids,
                key=lambda pid: (
                    len((parent_ids - {pid}) & families[pid]),
                    len(families[pid]),
                    pid,
                ),
            ):
                if _reaches(parent_id, child_id, parents):
                    LOGGER.warning(
                        "Ignoring cyclic partsList relation: Node %s, endpoint %s below %s",
                        self.node_id,
                        child_id,
                        parent_id,
                    )
                    continue
                parents[child_id] = parent_id
                break

        previous_composed = self._composed_endpoints
        previous_bridge = self._bridge_parents
        self._composed_endpoints = {}
        self._bridge_parents = {}
        decided = {
            child_id for child_id, parent_id in parents.items() if self._map_endpoint_parent(child_id, parent_id)
        }
        related = self._composed_endpoints | self._bridge_parents
        for relations, previous in (
            (self._composed_endpoints, previous_composed),
            (self._bridge_parents, previous_bridge),
        ):
            for child_id, parent_id in sorted(previous.items()):
                if child_id in related or (child_id in decided and parents[child_id] == parent_id):
                    continue
                if _reaches(parent_id, child_id, related):
                    LOGGER.warning(
                        "Dropping parent relation that a snapshot made cyclic: Node %s, endpoint %s below %s",
                        self.node_id,
                        child_id,
                        parent_id,
                    )
                    continue
                relations[child_id] = parent_id
                related[child_id] = parent_id

        self._report_bridged_devices_without_info()

    def _report_bridged_devices_without_info(self) -> None:
        """Warn about bridged devices the bridge does not describe, once per endpoint.

        Such an endpoint has no device info of its own, and the info of the bridge describes a
        different device, so it stays unnamed until the bridge reports it.
        """
        for endpoint_id, endpoint in self.endpoints.items():
            if endpoint_id in self._reported_missing_bridged_info:
                continue
            if not endpoint.is_bridged_device:
                continue
            if endpoint.get_cluster(Clusters.BridgedDeviceBasicInformation) is not None:
                continue
            self._reported_missing_bridged_info.add(endpoint_id)
            LOGGER.warning(
                "Bridged device without BridgedDeviceBasicInformation: Node %s, endpoint %s",
                self.node_id,
                endpoint_id,
            )

    def _map_endpoint_parent(self, child_id: int, parent_id: int) -> bool:
        """Record what the parent endpoint makes of the endpoint below it, return whether it decides.

        A child of the root endpoint is top level. Below an Aggregator, a Bridged Node is a
        bridged device; any other child stands alone, whether or not the Aggregator is itself a
        Bridged Node (so ids derived from the compose parent match older clients). Below any other endpoint, a child
        is a part of it - also when the device types of that endpoint are unknown to this client,
        so only a parent that reports no device type at all decides nothing.
        """
        if parent_id == ROOT_ENDPOINT_ID:
            return True
        parent = self.endpoints[parent_id]
        descriptor = parent.get_cluster(Clusters.Descriptor)
        assert descriptor is not None  # only endpoints with a Descriptor are parents
        if not descriptor.deviceTypeList:
            return False
        if RootNode in parent.device_types:
            return True
        if Aggregator not in parent.device_types:
            self._composed_endpoints[child_id] = parent_id
        elif BridgedNode in self.endpoints[child_id].device_types:
            self._bridge_parents[child_id] = parent_id
        return True

    def update_attribute(self, attribute_path: str, new_value: Any) -> None:
        """Handle Attribute value update."""
        endpoint_id = int(attribute_path.split("/", maxsplit=1)[0])
        if endpoint_id not in self.endpoints:
            # race condition when a bridge is in the process of adding a new endpoint
            return
        self.endpoints[endpoint_id].set_attribute_value(attribute_path, new_value)

    def __repr__(self) -> str:
        """Return the representation."""
        return f"<MatterNode {self.node_id}>"


class NodeType(Enum):
    """Custom Enum with Matter node types, used for diagnostics."""

    END_DEVICE = "end_device"
    SLEEPY_END_DEVICE = "sleepy_end_device"
    ROUTING_END_DEVICE = "routing_end_device"
    BRIDGE = "bridge"
    UNKNOWN = "unknown"


class NetworkType(Enum):
    """Custom Enum with Matter network types used for diagnostics."""

    THREAD = "thread"
    WIFI = "wifi"
    ETHERNET = "ethernet"
    UNKNOWN = "unknown"


@dataclass
class NodeDiagnostics:
    """
    Representation of a Node diagnostics message.

    This a custom model intended to be (easily) consumed by Home Assistant
    and constructed from various cluster attribute values.
    """

    node_id: int
    network_type: NetworkType
    node_type: NodeType
    network_name: str | None  # WiFi SSID or Thread network name
    # TODO: rename to ip_addresses in next major version (typo kept for API compatibility)
    ip_adresses: list[str]
    mac_address: str | None
    available: bool
    active_fabrics: list[MatterFabricData]
    active_fabric_index: int

    @property
    def ip_addresses(self) -> list[str]:
        """Return IP addresses (correctly-spelled alias for ip_adresses)."""
        return self.ip_adresses
