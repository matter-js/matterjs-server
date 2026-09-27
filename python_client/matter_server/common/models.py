"""Models that are (serializeable) shared between server and client."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime  # noqa: TC003
from enum import Enum
from typing import Any, Literal, Required, TypedDict

# Enums and constants


class EventType(Enum):
    """Enum with possible events sent from server to client."""

    NODE_ADDED = "node_added"
    NODE_UPDATED = "node_updated"
    NODE_REMOVED = "node_removed"
    NODE_EVENT = "node_event"
    ATTRIBUTE_UPDATED = "attribute_updated"
    SERVER_SHUTDOWN = "server_shutdown"
    SERVER_INFO_UPDATED = "server_info_updated"
    ENDPOINT_ADDED = "endpoint_added"
    ENDPOINT_REMOVED = "endpoint_removed"
    WEBRTC_CALLBACK = "webrtc_callback"
    THREAD_DIAGNOSTICS_UPDATED = "thread_diagnostics_updated"  # schema 12+
    NETWORK_TOPOLOGY_UPDATED = "network_topology_updated"  # schema 13+
    CAMERA_SESSION_ENDED = "camera_session_ended"  # schema 14+
    CAMERA_STREAM_EVICTED = "camera_stream_evicted"  # schema 14+


class APICommand(str, Enum):
    """Enum with all known API commands."""

    START_LISTENING = "start_listening"
    SERVER_DIAGNOSTICS = "diagnostics"
    SERVER_INFO = "server_info"
    GET_NODES = "get_nodes"
    GET_NODE = "get_node"
    COMMISSION_WITH_CODE = "commission_with_code"
    COMMISSION_ON_NETWORK = "commission_on_network"
    SET_WIFI_CREDENTIALS = "set_wifi_credentials"
    SET_THREAD_DATASET = "set_thread_dataset"
    REMOVE_WIFI_CREDENTIALS = "remove_wifi_credentials"
    REMOVE_THREAD_DATASET = "remove_thread_dataset"
    OPEN_COMMISSIONING_WINDOW = "open_commissioning_window"
    DISCOVER = "discover"
    INTERVIEW_NODE = "interview_node"
    DEVICE_COMMAND = "device_command"
    REMOVE_NODE = "remove_node"
    GET_VENDOR_NAMES = "get_vendor_names"
    READ_ATTRIBUTE = "read_attribute"
    WRITE_ATTRIBUTE = "write_attribute"
    PING_NODE = "ping_node"
    GET_NODE_IP_ADDRESSES = "get_node_ip_addresses"
    IMPORT_TEST_NODE = "import_test_node"
    CHECK_NODE_UPDATE = "check_node_update"
    UPDATE_NODE = "update_node"
    SET_DEFAULT_FABRIC_LABEL = "set_default_fabric_label"
    GET_FABRIC_LABEL = "get_fabric_label"
    SET_ACL_ENTRY = "set_acl_entry"
    SET_NODE_BINDING = "set_node_binding"
    SEND_WEBRTC_PROVIDER_COMMAND = "send_webrtc_provider_command"
    GET_ALL_CREDENTIALS = "get_all_credentials"
    GET_THREAD_BORDER_ROUTERS = "get_thread_border_routers"
    GET_THREAD_DIAGNOSTICS = "get_thread_diagnostics"
    GET_ICD_STATE = "get_icd_state"
    REGISTER_ICD = "register_icd"
    RESYNC_ICD = "resync_icd"
    UNREGISTER_ICD = "unregister_icd"
    GET_NETWORK_TOPOLOGY = "get_network_topology"
    INITIATE_OTA_UPLOAD = "initiate_ota_upload"
    CAMERA_GET_CAPABILITIES = "camera_get_capabilities"  # schema 14+
    CAMERA_START_STREAM = "camera_start_stream"  # schema 14+
    CAMERA_PROVIDE_ANSWER = "camera_provide_answer"  # schema 14+
    CAMERA_PROVIDE_ICE_CANDIDATES = "camera_provide_ice_candidates"  # schema 14+
    CAMERA_STOP_STREAM = "camera_stop_stream"  # schema 14+
    CAMERA_SNAPSHOT = "camera_snapshot"  # schema 14+
    CAMERA_RELEASE_STREAM = "camera_release_stream"  # schema 14+


EventCallBackType = Callable[[EventType, Any], None]

# Generic model(s)


@dataclass
class VendorInfo:
    """Vendor info as received from the CSA."""

    vendor_id: int
    vendor_name: str
    company_legal_name: str
    company_preferred_name: str
    vendor_landing_page_url: str
    creator: str


@dataclass
class MatterNodeData:
    """Matter node data as received from (and stored on) the server."""

    node_id: int
    date_commissioned: datetime
    last_interview: datetime
    interview_version: int
    available: bool = False
    is_bridge: bool = False
    # attributes are stored in form of AttributePath: ENDPOINT/CLUSTER_ID/ATTRIBUTE_ID
    attributes: dict[str, Any] = field(default_factory=dict)
    # all attribute subscriptions we need to persist for this node,
    # a set of tuples in format (endpoint_id, cluster_id, attribute_id)
    # where each value can also be a None for wildcard
    attribute_subscriptions: set[tuple[int | None, int | None, int | None]] = field(default_factory=set)


@dataclass
class MatterNodeEvent:
    """Representation of a NodeEvent for a Matter node."""

    node_id: int
    endpoint_id: int
    cluster_id: int
    event_id: int
    event_number: int
    priority: int
    timestamp: int
    timestamp_type: int
    data: dict[str, Any] | None


WebRTCEventType = Literal["offer", "answer", "ice_candidates", "end"]


@dataclass
class WebRTCIceCandidate:
    """ICE candidate carried inside a webrtc_callback.ice_candidates event."""

    candidate: str
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None


@dataclass
class WebRTCCallbackData:
    """Payload of a webrtc_callback event.

    `data` shape varies by event_type:
      - "offer": {"sdp": str, "ice_servers": list | None, "ice_transport_policy": str | None}
      - "answer": {"sdp": str}
      - "ice_candidates": {"ice_candidates": list[WebRTCIceCandidate]}
      - "end": {"reason": int}
    """

    event_type: WebRTCEventType
    webrtc_session_id: int
    node_id: int
    endpoint_id: int
    fabric_index: int
    data: dict | None


@dataclass
class ServerDiagnostics:
    """Full dump of the server information and data."""

    info: ServerInfoMessage
    nodes: list[MatterNodeData]
    events: list[dict]


NodePingResult = dict[str, bool]


# API message models


@dataclass
class CommandMessage:
    """Model for a Message holding a command from server to client or client to server."""

    message_id: str
    command: str
    args: dict[str, Any] | None = None


@dataclass
class ResultMessageBase:
    """Base class for a result/response of a Command Message."""

    message_id: str


@dataclass
class SuccessResultMessage(ResultMessageBase):
    """Message sent when a Command has been successfully executed."""

    result: Any


@dataclass
class ErrorResultMessage(ResultMessageBase):
    """Message sent when a command did not execute successfully."""

    error_code: int
    details: str | None = None


@dataclass
class EventMessage:
    """Message sent when server or client signals a (stateless) event."""

    # An event type unknown to this client is passed through by parse_value as a raw string rather
    # than an EventType, so consumers must narrow before relying on enum members.
    event: EventType | str
    data: Any


@dataclass
class ServerInfoMessage:
    """Message sent by the server with it's info when a client connects."""

    fabric_id: int
    compressed_fabric_id: int
    schema_version: int
    min_supported_schema_version: int
    sdk_version: str
    wifi_credentials_set: bool
    thread_credentials_set: bool
    bluetooth_enabled: bool
    wifi_ssid: str | None = None
    ble_proxy_enabled: bool = False


MessageType = CommandMessage | EventMessage | SuccessResultMessage | ErrorResultMessage | ServerInfoMessage


@dataclass
class CommissionableNodeData:
    """Object that is returned on the 'discover_commissionable_nodes' command."""

    # pylint: disable=too-many-instance-attributes

    instance_name: str | None = None
    host_name: str | None = None
    port: int | None = None
    long_discriminator: int | None = None
    vendor_id: int | None = None
    product_id: int | None = None
    commissioning_mode: int | None = None
    device_type: int | None = None
    device_name: str | None = None
    pairing_instruction: str | None = None
    pairing_hint: int | None = None
    mrp_retry_interval_idle: int | None = None
    mrp_retry_interval_active: int | None = None
    supports_tcp: bool | None = None
    addresses: list[str] | None = None
    rotating_id: str | None = None


@dataclass
class CommissioningParameters:
    """Object that is returned on the 'open_commisisoning_window' command."""

    setup_pin_code: int
    setup_manual_code: str
    setup_qr_code: str


@dataclass
class IcdStateData:
    """ICD controller-side state for a node. Note: Only available with OHF Matter Server."""

    supported: bool
    lit_supported: bool
    registered: bool
    operating_mode: str | None
    awake: bool | None
    available: bool | None
    next_expected_checkin: int | None


@dataclass
class TopologyDirectionInfo:
    """One direction's observed link quality on a topology connection.

    Note: Only available with OHF Matter Server (schema 13+).
    """

    strength: str
    lqi: int | None = None
    rssi: int | None = None


@dataclass
class NetworkTopologyNode:
    """A node in the network topology graph.

    `kind`/`role` values are open string sets so a newer server can
    introduce values without breaking older clients.
    Note: Only available with OHF Matter Server (schema 13+).
    """

    # pylint: disable=too-many-instance-attributes

    id: str
    kind: str  # matter | border_router | thread_unknown | wifi_ap
    network_type: str  # thread | wifi | ethernet | unknown
    node_id: int | None = None
    role: str | None = None
    available: bool | None = None
    is_bridge: bool | None = None
    ext_address: str | None = None
    rloc16: int | None = None
    ext_pan_id: str | None = None
    network_name: str | None = None
    # Wi-Fi SSID and BSSID, on wifi_ap nodes and the stations joined to them.
    ssid: str | None = None
    bssid: str | None = None
    # Border router mDNS host name, already normalized to a display label.
    host_name: str | None = None
    vendor_name: str | None = None
    model_name: str | None = None
    last_seen: int | None = None


@dataclass
class NetworkTopologyConnection:
    """An edge between two topology nodes.

    Thread links may be asymmetric: `source_to_target`/`target_to_source` carry
    each observed direction; the top-level `strength` is the strongest of them.
    Note: Only available with OHF Matter Server (schema 13+).
    """

    source: str
    target: str
    network: str  # thread | wifi
    strength: str  # strong | medium | weak | none
    source_to_target: TopologyDirectionInfo | None = None
    target_to_source: TopologyDirectionInfo | None = None
    via_route_table: bool | None = None
    path_cost: int | None = None


@dataclass
class NetworkTopology:
    """Snapshot of the Matter network topology (Thread mesh + Wi-Fi).

    Returned by the 'get_network_topology' command and pushed via the
    'network_topology_updated' event.
    Note: Only available with OHF Matter Server (schema 13+).
    """

    collected_at: int
    nodes: list[NetworkTopologyNode]
    connections: list[NetworkTopologyConnection]


class UpdateSource(Enum):
    """Enum with possible sources for a software update."""

    MAIN_NET_DCL = "main-net-dcl"
    TEST_NET_DCL = "test-net-dcl"
    LOCAL = "local"


@dataclass
class OtaUploadTicket:
    """Single-use authorization for one OTA firmware upload.

    Returned by the initiate_ota_upload command (schema 13) and spent by a POST to
    /ota-upload/<upload_id>. `expires_in` seconds bounds when that POST may *start*.
    """

    upload_id: str
    expires_in: int
    max_size: int


@dataclass
class MatterSoftwareVersion:
    """Representation of a Matter software version. Return by the check_node_update command.

    This holds Matter software version information similar to what is available from the CSA DCL.
    https://on.dcl.csa-iot.org/#/Query/ModelVersion.
    """

    vid: int
    pid: int
    software_version: int
    software_version_string: str
    firmware_information: str | None
    min_applicable_software_version: int
    max_applicable_software_version: int
    release_notes_url: str | None
    update_source: UpdateSource

    @classmethod
    def from_dict(cls, data: dict) -> MatterSoftwareVersion:
        """Initialize from dict."""
        return cls(
            vid=data["vid"],
            pid=data["pid"],
            software_version=data["software_version"],
            software_version_string=data["software_version_string"],
            firmware_information=data["firmware_information"],
            min_applicable_software_version=data["min_applicable_software_version"],
            max_applicable_software_version=data["max_applicable_software_version"],
            release_notes_url=data["release_notes_url"],
            update_source=UpdateSource(data["update_source"]),
        )

    def as_dict(self) -> dict:
        """Return dict representation of the object."""
        return {
            "vid": self.vid,
            "pid": self.pid,
            "software_version": self.software_version,
            "software_version_string": self.software_version_string,
            "firmware_information": self.firmware_information,
            "min_applicable_software_version": self.min_applicable_software_version,
            "max_applicable_software_version": self.max_applicable_software_version,
            "release_notes_url": self.release_notes_url,
            "update_source": self.update_source.value,
        }


# Camera API (schema 14+). Names are spelled as on the wire; value sets such as codec names,
# stream usages and `provenance` stay `str` so a newer server can add values.


class CameraResolutionHint(TypedDict):
    """A resolution in a camera command's arguments."""

    width: int
    height: int


class CameraVideoHints(TypedDict, total=False):
    """Video hints for `camera_start_stream`; every stated key is a hard requirement."""

    codecs: list[str]
    min_resolution: CameraResolutionHint
    max_resolution: CameraResolutionHint
    min_frame_rate: int
    max_frame_rate: int
    min_bit_rate: int
    max_bit_rate: int
    watermark_enabled: bool
    osd_enabled: bool


class CameraAudioHints(TypedDict, total=False):
    """Audio hints for `camera_start_stream`; stating any key makes audio required."""

    codecs: list[str]
    channel_count: int
    sample_rate: int
    bit_rate: int


class CameraIceServer(TypedDict, total=False):
    """An ICE server in the W3C `RTCIceServer` spelling."""

    urls: Required[str | list[str]]
    username: str
    credential: str
    caid: int


@dataclass
class CameraResolution:
    """A resolution as the camera reports it."""

    width: int
    height: int


@dataclass
class CameraRateDistortionPoint:
    """A codec/resolution trade-off point and its minimum bit rate."""

    codec: str
    resolution: CameraResolution
    min_bit_rate: int


@dataclass
class CameraSnapshotCapability:
    """One snapshot capability; `image_codec` is the value `camera_snapshot` takes as `codec`."""

    resolution: CameraResolution
    max_frame_rate: int
    image_codec: str
    requires_encoded_pixels: bool
    requires_hardware_encoder: bool


@dataclass
class CameraAllocatedVideoStream:
    """A video stream allocated on the camera."""

    # pylint: disable=too-many-instance-attributes

    video_stream_id: int
    stream_usage: str
    video_codec: str
    min_resolution: CameraResolution
    max_resolution: CameraResolution
    min_frame_rate: int
    max_frame_rate: int
    min_bit_rate: int
    max_bit_rate: int
    reference_count: int
    allocated_by_server: bool
    watermark_enabled: bool
    osd_enabled: bool


@dataclass
class CameraAllocatedAudioStream:
    """An audio stream allocated on the camera."""

    audio_stream_id: int
    stream_usage: str
    audio_codec: str
    channel_count: int
    sample_rate: int
    bit_rate: int
    bit_depth: int
    reference_count: int
    allocated_by_server: bool


@dataclass
class CameraAllocatedSnapshotStream:
    """A snapshot stream allocated on the camera.

    A stream with `hardware_encoder` holds one of the camera's encoders until it is released,
    whatever `reference_count` says.
    """

    # pylint: disable=too-many-instance-attributes

    snapshot_stream_id: int
    image_codec: str
    min_resolution: CameraResolution
    max_resolution: CameraResolution
    reference_count: int
    allocated_by_server: bool
    frame_rate: int
    encoded_pixels: bool
    hardware_encoder: bool
    watermark_enabled: bool
    osd_enabled: bool


@dataclass
class CameraWebRtcSession:
    """A WebRTC session of this server's fabric, as the camera's `CurrentSessions` lists it.

    `camera_stop_stream` can end it exactly when `established_by_this_server` is true.
    """

    webrtc_session_id: int
    peer_node_id: int
    peer_endpoint_id: int
    stream_usage: str
    video_stream_ids: list[int]
    audio_stream_ids: list[int]
    established_by_this_server: bool


@dataclass
class CameraPrivacy:
    """The camera's privacy switches; `None` where the camera has no such switch."""

    soft_recording_mode_enabled: bool | None = None
    soft_livestream_mode_enabled: bool | None = None
    hard_mode_on: bool | None = None


@dataclass
class CameraVideoCapabilities:
    """Video facts the camera states."""

    rate_distortion_points: list[CameraRateDistortionPoint]
    codecs: list[str]
    sensor: CameraResolution | None = None
    min_viewport: CameraResolution | None = None
    max_fps: int | None = None
    max_hdr_fps: int | None = None
    hdr_capable: bool | None = None


@dataclass
class CameraAudioCapabilities:
    """Audio facts the camera states."""

    codecs: list[str]
    sample_rates: list[int]
    bit_depths: list[int]
    channels: int | None = None
    two_way_talk_support: str | None = None


@dataclass
class CameraSnapshotCapabilities:
    """Snapshot facts the camera states."""

    capabilities: list[CameraSnapshotCapability]


@dataclass
class CameraLimits:
    """Capacity limits and stream usages the camera states."""

    supported_stream_usages: list[str]
    stream_usage_priorities: list[str]
    max_encoded_pixel_rate: int | None = None
    max_concurrent_encoders: int | None = None
    max_network_bandwidth: int | None = None


@dataclass
class CameraAllocatedStreams:
    """The streams currently allocated on the camera."""

    video: list[CameraAllocatedVideoStream]
    audio: list[CameraAllocatedAudioStream]
    snapshot: list[CameraAllocatedSnapshotStream]


@dataclass
class CameraCapabilities:
    """Result of `camera_get_capabilities`.

    `features` is `None` while the camera has not reported its feature map; the server then
    gates nothing on features. An empty list means the camera advertises none.
    """

    privacy: CameraPrivacy
    video: CameraVideoCapabilities
    audio: CameraAudioCapabilities
    snapshot: CameraSnapshotCapabilities
    limits: CameraLimits
    allocated: CameraAllocatedStreams
    sessions: list[CameraWebRtcSession]
    features: list[str] | None = None


@dataclass
class CameraResolutionRange:
    """A resolution range."""

    min: CameraResolution
    max: CameraResolution


@dataclass
class CameraValueRange:
    """A numeric range."""

    min: int
    max: int


@dataclass
class CameraEncoderBudgetNarrowing:
    """Ceilings the encoder budget lowered, each holding the value it would have had without it."""

    max_frame_rate: int | None = None
    max_resolution: CameraResolution | None = None


@dataclass
class CameraStartStreamVideoResult:
    """The video track of a `camera_start_stream` result.

    `provenance` is `allocated`, `reused` or `adopted`. `evicted_stream_ids` and
    `narrowed_by_encoder_budget` are `None` when the request evicted or narrowed nothing.
    """

    # pylint: disable=too-many-instance-attributes

    stream_id: int
    codec: str
    resolution: CameraResolutionRange
    frame_rate: CameraValueRange
    bit_rate: CameraValueRange
    provenance: str
    degraded: bool
    watermark_enabled: bool
    osd_enabled: bool
    evicted_stream_ids: list[int] | None = None
    narrowed_by_encoder_budget: CameraEncoderBudgetNarrowing | None = None


@dataclass
class CameraStartStreamAudioResult:
    """The audio track of a `camera_start_stream` result."""

    stream_id: int
    codec: str
    channel_count: int
    sample_rate: int
    bit_rate: int
    bit_depth: int
    provenance: str


@dataclass
class CameraStartStreamResult:
    """Result of `camera_start_stream`; `mode` is `solicit_offer` or `provide_offer`."""

    webrtc_session_id: int
    mode: str
    video: CameraStartStreamVideoResult | None
    audio: CameraStartStreamAudioResult | None


@dataclass
class CameraStopStreamResult:
    """Result of `camera_stop_stream`; `ended` is false when the camera did not know the session."""

    ended: bool


@dataclass
class CameraSnapshotResult:
    """Result of `camera_snapshot`.

    `data` is the base64-encoded image. The snapshot stream `stream_id` stays allocated until
    `camera_release_stream` frees it. `provenance` is `allocated` (this call allocated the stream),
    `reused` or `adopted`, as on a `camera_start_stream` track.
    """

    data: str
    codec: str
    resolution: CameraResolution
    degraded: bool
    stream_id: int
    provenance: str


@dataclass
class CameraSessionEndedData:
    """Payload of the `camera_session_ended` event."""

    node_id: int
    endpoint_id: int
    webrtc_session_id: int


@dataclass
class CameraStreamEvictedData:
    """Payload of the `camera_stream_evicted` event; `kind` is `video` or `snapshot`."""

    node_id: int
    endpoint_id: int
    kind: str
    stream_id: int


@dataclass
class CameraStreamIncompatibleBound:
    """The caller bound error 102 ruled out before asking the camera, with values as text."""

    field: str
    requested: str
    limit: str


@dataclass
class CameraOccupyingStream:
    """A stream holding capacity a request refused with error 103 needed."""

    kind: str
    stream_id: int
    reference_count: int
