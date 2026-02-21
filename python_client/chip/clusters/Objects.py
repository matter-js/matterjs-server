"""
 Cluster object definitions.
 This file is auto-generated, DO NOT edit.
 Users can import chip.clusters.Objects to get all cluster definitions.
"""

# Re-export all cluster classes from per-cluster files
from chip.clusters.objects import *  # noqa: F401,F403

# Also re-export base classes for backward compatibility
from chip.clusters.ClusterObjects import (  # noqa: F401
    Cluster,
    ClusterAttributeDescriptor,
    ClusterCommand,
    ClusterEvent,
    ClusterObject,
    ClusterObjectDescriptor,
    ClusterObjectFieldDescriptor,
)

