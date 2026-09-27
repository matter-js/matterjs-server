"""Unit tests for the typed camera API wrappers, their result models and camera error details."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from matter_server.client import MatterClient
from matter_server.client.exceptions import ServerVersionTooOld
from matter_server.common.errors import (
    CameraNotSupported,
    CameraPrivacyMode,
    CameraResourceExhausted,
    CameraStreamIncompatible,
    CameraStreamInUse,
    IcdMultiAdmin,
    exception_from_error_code,
)
from matter_server.common.models import (
    APICommand,
    CameraCapabilities,
    CameraEncoderBudgetNarrowing,
    CameraOccupyingStream,
    CameraResolution,
    CameraSnapshotResult,
    CameraStartStreamResult,
    CameraStopStreamResult,
    CameraStreamIncompatibleBound,
    CameraVideoHints,
    ServerInfoMessage,
    WebRTCIceCandidate,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable


def _bare_client(response: Any = None) -> MatterClient:
    client = MatterClient.__new__(MatterClient)
    client.send_command = AsyncMock(return_value=response)
    return client


def _gated_client(schema_version: int) -> MatterClient:
    """Return a client whose real send_command runs the schema gate against `schema_version`."""
    client = MatterClient.__new__(MatterClient)
    connection = MagicMock()
    connection.connected = True
    connection.server_info = ServerInfoMessage(
        fabric_id=1,
        compressed_fabric_id=1,
        schema_version=schema_version,
        min_supported_schema_version=1,
        sdk_version="0.0.0",
        wifi_credentials_set=False,
        thread_credentials_set=False,
        bluetooth_enabled=False,
    )
    client.connection = connection
    client._loop = asyncio.get_running_loop()
    client._result_futures = {}
    return client


def _sent(client: MatterClient) -> tuple[Any, dict[str, Any]]:
    mock = client.send_command
    assert isinstance(mock, AsyncMock)
    args, kwargs = mock.call_args
    return args[0], kwargs


_RESOLUTION = {"width": 1920, "height": 1080}

_WIRE_CAPABILITIES: dict[str, Any] = {
    "features": ["Video", "Snapshot"],
    "privacy": {"soft_livestream_mode_enabled": False},
    "video": {
        "sensor": _RESOLUTION,
        "max_fps": 30,
        "rate_distortion_points": [{"codec": "H264", "resolution": _RESOLUTION, "min_bit_rate": 10000}],
        "codecs": ["H264"],
    },
    "audio": {"codecs": ["OPUS"], "channels": 2, "sample_rates": [48000], "bit_depths": [16]},
    "snapshot": {
        "capabilities": [
            {
                "resolution": _RESOLUTION,
                "max_frame_rate": 10,
                "image_codec": "JPEG",
                "requires_encoded_pixels": False,
                "requires_hardware_encoder": True,
            }
        ]
    },
    "limits": {
        "max_encoded_pixel_rate": 62208000,
        "supported_stream_usages": ["LiveView", "Recording"],
        "stream_usage_priorities": ["LiveView"],
    },
    "allocated": {
        "video": [
            {
                "video_stream_id": 1,
                "stream_usage": "LiveView",
                "video_codec": "H264",
                "min_resolution": _RESOLUTION,
                "max_resolution": _RESOLUTION,
                "min_frame_rate": 15,
                "max_frame_rate": 30,
                "min_bit_rate": 10000,
                "max_bit_rate": 2000000,
                "reference_count": 1,
                "allocated_by_server": True,
                "watermark_enabled": False,
                "osd_enabled": True,
            }
        ],
        "audio": [],
        "snapshot": [
            {
                "snapshot_stream_id": 4,
                "image_codec": "JPEG",
                "min_resolution": _RESOLUTION,
                "max_resolution": _RESOLUTION,
                "reference_count": 0,
                "allocated_by_server": False,
                "frame_rate": 10,
                "encoded_pixels": False,
                "hardware_encoder": True,
                "watermark_enabled": False,
                "osd_enabled": False,
            }
        ],
    },
    "sessions": [
        {
            "webrtc_session_id": 9,
            "peer_node_id": 18446744073709551615,
            "peer_endpoint_id": 1,
            "stream_usage": "LiveView",
            "video_stream_ids": [1],
            "audio_stream_ids": [],
            "established_by_this_server": True,
        }
    ],
}

_WIRE_VIDEO_RESULT: dict[str, Any] = {
    "stream_id": 1,
    "codec": "H264",
    "resolution": {"min": {"width": 640, "height": 360}, "max": {"width": 1280, "height": 720}},
    "frame_rate": {"min": 15, "max": 30},
    "bit_rate": {"min": 10000, "max": 2000000},
    "provenance": "allocated",
    "degraded": False,
    "watermark_enabled": False,
    "osd_enabled": False,
}


async def _call_get_capabilities(client: MatterClient) -> object:
    return await client.camera_get_capabilities(5, 1)


async def _call_start_stream(client: MatterClient) -> object:
    return await client.camera_start_stream(5, 1, "LiveView")


async def _call_provide_answer(client: MatterClient) -> object:
    await client.camera_provide_answer(5, 1, 9, "v=0")
    return None


async def _call_provide_ice_candidates(client: MatterClient) -> object:
    await client.camera_provide_ice_candidates(5, 1, 9, [{"candidate": "c"}])
    return None


async def _call_stop_stream(client: MatterClient) -> object:
    return await client.camera_stop_stream(5, 1, 9)


async def _call_snapshot(client: MatterClient) -> object:
    return await client.camera_snapshot(5, 1)


async def _call_release_stream(client: MatterClient) -> object:
    await client.camera_release_stream(5, 1, "video", 1)
    return None


_WRAPPERS: list[tuple[Callable[[MatterClient], Awaitable[object]], APICommand]] = [
    (_call_get_capabilities, APICommand.CAMERA_GET_CAPABILITIES),
    (_call_start_stream, APICommand.CAMERA_START_STREAM),
    (_call_provide_answer, APICommand.CAMERA_PROVIDE_ANSWER),
    (_call_provide_ice_candidates, APICommand.CAMERA_PROVIDE_ICE_CANDIDATES),
    (_call_stop_stream, APICommand.CAMERA_STOP_STREAM),
    (_call_snapshot, APICommand.CAMERA_SNAPSHOT),
    (_call_release_stream, APICommand.CAMERA_RELEASE_STREAM),
]


@pytest.mark.parametrize("call", [call for call, _ in _WRAPPERS], ids=[command.value for _, command in _WRAPPERS])
async def test_wrapper_is_refused_by_a_schema_13_server(call: Callable[[MatterClient], Awaitable[object]]) -> None:
    client = _gated_client(13)
    send_message = AsyncMock()
    client.connection.send_message = send_message
    with pytest.raises(ServerVersionTooOld):
        await call(client)
    send_message.assert_not_awaited()


@pytest.mark.parametrize(("call", "command"), _WRAPPERS)
async def test_wrapper_sends_its_command_with_schema_14(
    call: Callable[[MatterClient], Awaitable[object]], command: APICommand
) -> None:
    responses: dict[APICommand, Any] = {
        APICommand.CAMERA_GET_CAPABILITIES: _WIRE_CAPABILITIES,
        APICommand.CAMERA_START_STREAM: {
            "webrtc_session_id": 9,
            "mode": "solicit_offer",
            "video": None,
            "audio": None,
        },
        APICommand.CAMERA_STOP_STREAM: {"ended": True},
        APICommand.CAMERA_SNAPSHOT: {
            "data": "AA==",
            "codec": "JPEG",
            "resolution": _RESOLUTION,
            "degraded": False,
            "stream_id": 4,
            "provenance": "allocated",
        },
    }
    client = _bare_client(responses.get(command))
    await call(client)
    sent_command, kwargs = _sent(client)
    assert sent_command == command
    assert kwargs["require_schema"] == 14
    assert kwargs["node_id"] == 5
    assert kwargs["endpoint_id"] == 1


async def test_start_stream_sends_no_unstated_argument() -> None:
    client = _bare_client({"webrtc_session_id": 9, "mode": "solicit_offer", "video": None, "audio": None})
    await client.camera_start_stream(5, 1, "LiveView")
    _, kwargs = _sent(client)
    assert kwargs == {"require_schema": 14, "node_id": 5, "endpoint_id": 1, "stream_usage": "LiveView"}


async def test_start_stream_sends_every_stated_argument() -> None:
    client = _bare_client({"webrtc_session_id": 9, "mode": "provide_offer", "video": None, "audio": None})
    video_hints: CameraVideoHints = {"codecs": ["H265", "H264"], "max_resolution": {"width": 1280, "height": 720}}
    await client.camera_start_stream(
        5,
        1,
        "LiveView",
        sdp="v=0",
        video=video_hints,
        audio=False,
        ice_servers=[{"urls": ["stun:stun.example.org"]}],
        ice_transport_policy="all",
        metadata_enabled=False,
        allow_eviction=False,
    )
    _, kwargs = _sent(client)
    assert kwargs == {
        "require_schema": 14,
        "node_id": 5,
        "endpoint_id": 1,
        "stream_usage": "LiveView",
        "sdp": "v=0",
        "video": video_hints,
        "audio": False,
        "ice_servers": [{"urls": ["stun:stun.example.org"]}],
        "ice_transport_policy": "all",
        "metadata_enabled": False,
        "allow_eviction": False,
    }


async def test_start_stream_parses_a_full_result() -> None:
    wire = {
        "webrtc_session_id": 9,
        "mode": "provide_offer",
        "video": {
            **_WIRE_VIDEO_RESULT,
            "provenance": "adopted",
            "degraded": True,
            "evicted_stream_ids": [2, 3],
            "narrowed_by_encoder_budget": {"max_frame_rate": 60, "max_resolution": _RESOLUTION},
        },
        "audio": {
            "stream_id": 7,
            "codec": "OPUS",
            "channel_count": 2,
            "sample_rate": 48000,
            "bit_rate": 64000,
            "bit_depth": 16,
            "provenance": "reused",
        },
    }
    result = await _bare_client(wire).camera_start_stream(5, 1, "LiveView", sdp="v=0")
    assert isinstance(result, CameraStartStreamResult)
    assert result.mode == "provide_offer"
    assert result.video is not None
    assert result.video.resolution.max == CameraResolution(1280, 720)
    assert result.video.frame_rate.min == 15
    assert result.video.bit_rate.max == 2000000
    assert result.video.provenance == "adopted"
    assert result.video.degraded is True
    assert result.video.evicted_stream_ids == [2, 3]
    assert result.video.narrowed_by_encoder_budget == CameraEncoderBudgetNarrowing(
        max_frame_rate=60, max_resolution=CameraResolution(1920, 1080)
    )
    assert result.audio is not None
    assert result.audio.stream_id == 7
    assert result.audio.provenance == "reused"


async def test_start_stream_leaves_absent_fields_none() -> None:
    wire = {"webrtc_session_id": 9, "mode": "solicit_offer", "video": _WIRE_VIDEO_RESULT, "audio": None}
    result = await _bare_client(wire).camera_start_stream(5, 1, "LiveView")
    assert result.video is not None
    assert result.video.evicted_stream_ids is None
    assert result.video.narrowed_by_encoder_budget is None
    assert result.audio is None


async def test_get_capabilities_parses_the_wire_result() -> None:
    result = await _bare_client(_WIRE_CAPABILITIES).camera_get_capabilities(5, 1)
    assert isinstance(result, CameraCapabilities)
    assert result.features == ["Video", "Snapshot"]
    assert result.privacy.soft_livestream_mode_enabled is False
    assert result.privacy.hard_mode_on is None
    assert result.video.sensor == CameraResolution(1920, 1080)
    assert result.video.min_viewport is None
    assert result.video.rate_distortion_points[0].codec == "H264"
    assert result.audio.channels == 2
    assert result.audio.two_way_talk_support is None
    assert result.snapshot.capabilities[0].requires_hardware_encoder is True
    assert result.limits.max_encoded_pixel_rate == 62208000
    assert result.limits.max_concurrent_encoders is None
    assert result.allocated.video[0].osd_enabled is True
    assert result.allocated.snapshot[0].hardware_encoder is True
    assert result.allocated.audio == []
    assert result.sessions[0].peer_node_id == 18446744073709551615
    assert result.sessions[0].established_by_this_server is True


async def test_get_capabilities_keeps_absent_features_apart_from_none_advertised() -> None:
    absent = {key: value for key, value in _WIRE_CAPABILITIES.items() if key != "features"}
    assert (await _bare_client(absent).camera_get_capabilities(5, 1)).features is None
    empty = {**_WIRE_CAPABILITIES, "features": []}
    assert (await _bare_client(empty).camera_get_capabilities(5, 1)).features == []


async def test_snapshot_sends_stated_arguments_and_parses_the_result() -> None:
    wire = {
        "data": "/9j/",
        "codec": "JPEG",
        "resolution": _RESOLUTION,
        "degraded": True,
        "stream_id": 4,
        "provenance": "adopted",
    }
    client = _bare_client(wire)
    result = await client.camera_snapshot(5, 1, max_resolution={"width": 640, "height": 480}, codec="JPEG")
    _, kwargs = _sent(client)
    assert kwargs == {
        "require_schema": 14,
        "node_id": 5,
        "endpoint_id": 1,
        "max_resolution": {"width": 640, "height": 480},
        "codec": "JPEG",
    }
    assert result == CameraSnapshotResult(
        data="/9j/",
        codec="JPEG",
        resolution=CameraResolution(1920, 1080),
        degraded=True,
        stream_id=4,
        provenance="adopted",
    )


async def test_snapshot_sends_overlay_flags_including_false() -> None:
    client = _bare_client(
        {
            "data": "",
            "codec": "JPEG",
            "resolution": _RESOLUTION,
            "degraded": False,
            "stream_id": 4,
            "provenance": "allocated",
        }
    )
    await client.camera_snapshot(5, 1, watermark_enabled=False, osd_enabled=True)
    _, kwargs = _sent(client)
    assert kwargs["watermark_enabled"] is False
    assert kwargs["osd_enabled"] is True
    assert "codec" not in kwargs
    assert "max_resolution" not in kwargs


async def test_stop_stream_parses_ended() -> None:
    client = _bare_client({"ended": False})
    assert await client.camera_stop_stream(5, 1, 9) == CameraStopStreamResult(ended=False)
    _, kwargs = _sent(client)
    assert kwargs["webrtc_session_id"] == 9


async def test_provide_answer_sends_session_and_sdp() -> None:
    client = _bare_client()
    await client.camera_provide_answer(5, 1, 9, "v=0")
    _, kwargs = _sent(client)
    assert kwargs["webrtc_session_id"] == 9
    assert kwargs["sdp"] == "v=0"


async def test_provide_ice_candidates_sends_dataclass_and_dict_candidates_as_dicts() -> None:
    client = _bare_client()
    from_event = {"candidate": "candidate:2", "sdpMid": "0", "sdpMLineIndex": 0}
    await client.camera_provide_ice_candidates(
        5, 1, 9, [WebRTCIceCandidate(candidate="candidate:1", sdpMid="0", sdpMLineIndex=0), from_event]
    )
    _, kwargs = _sent(client)
    assert kwargs["ice_candidates"] == [
        {"candidate": "candidate:1", "sdpMid": "0", "sdpMLineIndex": 0},
        from_event,
    ]


async def test_release_stream_sends_kind_and_id() -> None:
    client = _bare_client()
    await client.camera_release_stream(5, 1, "snapshot", 4)
    _, kwargs = _sent(client)
    assert kwargs["kind"] == "snapshot"
    assert kwargs["stream_id"] == 4


@pytest.mark.parametrize(
    ("code", "cls"),
    [
        (102, CameraStreamIncompatible),
        (103, CameraResourceExhausted),
        (104, CameraStreamInUse),
        (105, CameraNotSupported),
        (106, CameraPrivacyMode),
    ],
)
def test_error_code_maps_to_its_class(code: int, cls: type) -> None:
    assert exception_from_error_code(code) is cls


def test_stream_incompatible_parses_a_bounds_failure() -> None:
    exc = CameraStreamIncompatible(
        '{"message": "No stream meets the bounds", "reason": "bounds", "track": "video", "device": ["H264"],'
        ' "requested": ["H264"], "bound": {"field": "min_resolution", "requested": "3840x2160",'
        ' "limit": "1920x1080"}, "device_status": 135}'
    )
    assert str(exc) == "No stream meets the bounds"
    assert exc.reason == "bounds"
    assert exc.track == "video"
    assert exc.feature is None
    assert exc.device == ["H264"]
    assert exc.requested == ["H264"]
    assert exc.bound == CameraStreamIncompatibleBound(field="min_resolution", requested="3840x2160", limit="1920x1080")
    assert exc.device_status == 135


def test_stream_incompatible_parses_a_feature_failure_without_track_or_bound() -> None:
    exc = CameraStreamIncompatible(
        '{"message": "m", "reason": "feature", "feature": "Watermark", "device": [], "requested": []}'
    )
    assert exc.reason == "feature"
    assert exc.feature == "Watermark"
    assert exc.track is None
    assert exc.bound is None
    assert exc.device_status is None


def test_stream_incompatible_drops_a_bound_missing_a_field() -> None:
    exc = CameraStreamIncompatible('{"message": "m", "reason": "bounds", "bound": {"field": "min_frame_rate"}}')
    assert exc.bound is None


def test_resource_exhausted_parses_occupying_streams() -> None:
    exc = CameraResourceExhausted(
        '{"message": "Camera has no capacity for this stream", "allocated": [{"kind": "video", "stream_id": 1,'
        ' "reference_count": 2}, {"kind": "video"}], "max_concurrent_encoders": 1}'
    )
    assert exc.allocated == [CameraOccupyingStream(kind="video", stream_id=1, reference_count=2)]
    assert exc.max_concurrent_encoders == 1
    assert exc.max_encoded_pixel_rate is None


def test_stream_in_use_parses_id_and_count() -> None:
    exc = CameraStreamInUse('{"message": "m", "stream_id": 4, "reference_count": 1}')
    assert exc.stream_id == 4
    assert exc.reference_count == 1
    assert CameraStreamInUse('{"message": "m", "stream_id": 4}').reference_count is None


def test_not_supported_parses_missing_clusters() -> None:
    assert CameraNotSupported('{"message": "m", "missing_clusters": [1363, 1361]}').missing_clusters == [1363, 1361]


def test_privacy_mode_parses_modes_and_status() -> None:
    exc = CameraPrivacyMode('{"message": "m", "modes": ["hard_mode_on"], "device_status": 148}')
    assert exc.modes == ["hard_mode_on"]
    assert exc.device_status == 148


def test_error_field_of_the_wrong_type_reads_as_absent() -> None:
    exc = CameraStreamIncompatible('{"reason": 5, "device": "H264", "requested": ["H264", 7], "device_status": true}')
    assert exc.reason is None
    assert exc.device == []
    assert exc.requested == ["H264"]
    assert exc.device_status is None


def test_error_structures_of_the_wrong_type_read_as_absent() -> None:
    assert CameraStreamIncompatible('{"reason": "bounds", "bound": "1920x1080"}').bound is None
    assert CameraResourceExhausted('{"allocated": 5}').allocated == []
    assert CameraNotSupported('{"missing_clusters": [1363, "1361", true]}').missing_clusters == [1363]


_CAMERA_ERRORS = [CameraStreamIncompatible, CameraResourceExhausted, CameraStreamInUse, CameraNotSupported]


@pytest.mark.parametrize("cls", [*_CAMERA_ERRORS, CameraPrivacyMode, IcdMultiAdmin])
@pytest.mark.parametrize("details", ["not json {", "[1, 2]", '"a string"'])
def test_error_keeps_undecodable_details_as_its_message(cls: type[Exception], details: str) -> None:
    assert str(cls(details)) == details


@pytest.mark.parametrize("cls", [*_CAMERA_ERRORS, CameraPrivacyMode])
def test_error_without_details_or_message_has_a_fallback_message(cls: type[Exception]) -> None:
    assert str(cls())
    assert str(cls("{}")) == str(cls())
