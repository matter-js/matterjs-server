"""Tests for the WebRTC additions to the websocket protocol model."""

from matter_server.common.models import (
    APICommand,
    EventType,
    WebRTCCallbackData,
    WebRTCIceCandidate,
)


def test_event_type_webrtc_callback_value():
    assert EventType.WEBRTC_CALLBACK.value == "webrtc_callback"


def test_api_command_send_webrtc_provider_command_value():
    assert APICommand.SEND_WEBRTC_PROVIDER_COMMAND.value == "send_webrtc_provider_command"


def test_api_command_covers_every_camera_command():
    """The server's seven camera commands all need a name here.

    A command missing from the enum is one a caller can only reach by writing the
    string out, which is what let the two signalling commands go unnoticed.
    """
    assert {command.value for command in APICommand if command.value.startswith("camera_")} == {
        "camera_get_capabilities",
        "camera_start_stream",
        "camera_provide_answer",
        "camera_provide_ice_candidates",
        "camera_stop_stream",
        "camera_snapshot",
        "camera_release_stream",
    }


def test_webrtc_callback_data_roundtrip():
    payload = WebRTCCallbackData(
        event_type="answer",
        webrtc_session_id=5,
        node_id=100,
        endpoint_id=2,
        fabric_index=1,
        data={"sdp": "v=0"},
    )
    assert payload.event_type == "answer"
    assert payload.webrtc_session_id == 5
    assert payload.data == {"sdp": "v=0"}


def test_webrtc_ice_candidate_optional_fields():
    c = WebRTCIceCandidate(candidate="candidate:foo")
    assert c.sdpMid is None
    assert c.sdpMLineIndex is None
