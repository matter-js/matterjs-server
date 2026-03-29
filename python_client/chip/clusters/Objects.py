"""
 Cluster object definitions.
 This file is auto-generated, DO NOT edit.
 Users can import chip.clusters.Objects to get all cluster definitions.
"""

# Re-export all cluster classes from per-cluster files
from chip.clusters.objects import *  # noqa: F401,F403

# Explicit assignments for base classes and primitive types so that
# pylint can resolve them as module-level names (pylint cannot follow
# re-exports via 'from ... import' for E0611 no-name-in-module).
import chip.clusters.ClusterObjects as _co  # noqa: E402
import chip.clusters.Types as _types  # noqa: E402
import chip.tlv as _tlv  # noqa: E402

Cluster = _co.Cluster
ClusterAttributeDescriptor = _co.ClusterAttributeDescriptor
ClusterCommand = _co.ClusterCommand
ClusterEvent = _co.ClusterEvent
ClusterObject = _co.ClusterObject
ClusterObjectDescriptor = _co.ClusterObjectDescriptor
ClusterObjectFieldDescriptor = _co.ClusterObjectFieldDescriptor
NullValue = _types.NullValue
Nullable = _types.Nullable
float32 = _tlv.float32
uint = _tlv.uint

# Export list for type checkers
__all__ = [
    "Cluster",
    "ClusterAttributeDescriptor",
    "ClusterCommand",
    "ClusterEvent",
    "ClusterObject",
    "ClusterObjectDescriptor",
    "ClusterObjectFieldDescriptor",
    "NullValue",
    "Nullable",
    "float32",
    "uint",
    # Clusters from objects module are exported via *
]

