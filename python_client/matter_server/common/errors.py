"""Matter Exceptions."""

from __future__ import annotations

import json
from typing import Any

from matter_server.common.models import CameraOccupyingStream, CameraStreamIncompatibleBound

# mapping from error_code to Exception class
ERROR_MAP: dict[int, type] = {}


class MatterError(Exception):
    """Generic Matter exception."""

    error_code = 0

    def __init_subclass__(cls, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
        """Register a subclass."""
        super().__init_subclass__(*args, **kwargs)
        ERROR_MAP[cls.error_code] = cls


class UnknownError(MatterError):
    """Error raised when there an unknown/invalid command is requested."""

    error_code = 0  # to map all generic errors


class NodeCommissionFailed(MatterError):
    """Error raised when interview of a device failed."""

    error_code = 1


class NodeInterviewFailed(MatterError):
    """Error raised when interview of a device failed."""

    error_code = 2


class NodeNotReady(MatterError):
    """Error raised when performing action on node that has not been fully added."""

    error_code = 3


class NodeNotResolving(MatterError):
    """Error raised when no CASE session could be established."""

    error_code = 4


class NodeNotExists(MatterError):
    """Error raised when performing action on node that does not exist."""

    error_code = 5


class VersionMismatch(MatterError):
    """Issue raised when SDK version mismatches."""

    error_code = 6


class SDKStackError(MatterError):
    """Generic SDK stack error."""

    error_code = 7


class InvalidArguments(MatterError):
    """Error raised when there are invalid arguments provided for a command."""

    error_code = 8


class InvalidCommand(MatterError):
    """Error raised when there an unknown/invalid command is requested."""

    error_code = 9


class UpdateCheckError(MatterError):
    """Error raised when there was an error during searching for updates."""

    error_code = 10


class UpdateError(MatterError):
    """Error raised when there was an error during applying updates."""

    error_code = 11


class IcdMultiAdmin(MatterError):
    """Error raised when ICD registration is rejected due to other admin fabrics.

    OHF extension (python-matter-server codes stop at 11); `details` is a JSON string
    `{"message": str, "admin_vendor_ids": list[int]}`.
    """

    error_code = 100

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` and expose `admin_vendor_ids`."""
        parsed, message = _parse_details(
            details, "ICD registration rejected: the peer has administrator fabrics from other vendors"
        )
        self.admin_vendor_ids: list[int] = _int_list(parsed.get("admin_vendor_ids"))
        super().__init__(message)


class OtaUploadError(MatterError):
    """Error raised when uploading a local OTA firmware image failed.

    OHF extension (python-matter-server codes stop at 11). Covers a corrupt image, an
    unknown/expired/already-used upload id, disabled OTA support and store failures.
    """

    error_code = 101


class CameraStreamIncompatible(MatterError):
    """Raised when the camera, the caller's offer or the request rules the stream out.

    ``reason`` says which:

    - ``codec``: no codec both the camera and the caller, or the caller's offer, can carry.
    - ``bounds``: a range the camera cannot meet; ``bound`` names the bound when the server ruled
      it out before asking the camera.
    - ``feature``: the camera's AVSM ``FeatureMap`` lacks what the request needs, named in
      ``feature`` (only this reason carries that field).
    - ``capability``: the feature is advertised, but no stated capability fits the request.
    - ``offer``: the caller's SDP refuses the track's media section, will not receive on it,
      or has none.
    - ``no_media``: the request leaves no media for the session.
    - ``level``: the offer states a decode ceiling the server cannot read.

    ``codec`` is fixed in the command arguments or the SDP, ``bounds`` and ``no_media`` (ask
    for a track) in the command arguments, ``offer`` and ``level`` in the client's SDP, and
    ``feature`` and ``capability`` in neither.

    ``track`` is ``video`` or ``audio`` for a ``camera_start_stream`` track failure. ``device``
    lists the camera's codec names and is empty when the camera did not refuse. ``device_status``
    is the Matter status the camera answered with, when a device rejection produced the error.
    Attributes the details do not carry are ``None`` or empty.
    """

    error_code = 102

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` into typed attributes."""
        parsed, message = _parse_details(details, "Camera stream is incompatible with the request")
        self.reason: str | None = _optional_str(parsed.get("reason"))
        self.track: str | None = _optional_str(parsed.get("track"))
        self.feature: str | None = _optional_str(parsed.get("feature"))
        self.device: list[str] = _str_list(parsed.get("device"))
        self.requested: list[str] = _str_list(parsed.get("requested"))
        self.bound: CameraStreamIncompatibleBound | None = _bound(parsed.get("bound"))
        self.device_status: int | None = _optional_int(parsed.get("device_status"))
        super().__init__(message)


class CameraResourceExhausted(MatterError):
    """Raised when the camera refused the allocation for lack of capacity.

    ``allocated`` lists the streams holding the capacity; their ``kind`` is not always the kind
    that was asked for (a refused snapshot reports the video streams).
    """

    error_code = 103

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` into typed attributes."""
        parsed, message = _parse_details(details, "Camera has no capacity for this stream")
        allocated = parsed.get("allocated")
        entries = allocated if isinstance(allocated, list) else []
        self.allocated: list[CameraOccupyingStream] = [
            stream for stream in map(_occupying_stream, entries) if stream is not None
        ]
        self.max_concurrent_encoders: int | None = _optional_int(parsed.get("max_concurrent_encoders"))
        self.max_encoded_pixel_rate: int | None = _optional_int(parsed.get("max_encoded_pixel_rate"))
        super().__init__(message)


class CameraStreamInUse(MatterError):
    """Raised when stream release is refused because the device still references the stream.

    ``reference_count`` is the count the server last read, ``None`` when that count was zero.
    """

    error_code = 104

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` into typed attributes."""
        parsed, message = _parse_details(details, "Stream is in use and cannot be released")
        self.stream_id: int | None = _optional_int(parsed.get("stream_id"))
        self.reference_count: int | None = _optional_int(parsed.get("reference_count"))
        super().__init__(message)


class CameraNotSupported(MatterError):
    """Raised when an endpoint does not expose the clusters camera streaming needs."""

    error_code = 105

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` into typed attributes."""
        parsed, message = _parse_details(details, "Endpoint does not support camera streaming")
        self.missing_clusters: list[int] = _int_list(parsed.get("missing_clusters"))
        super().__init__(message)


class CameraPrivacyMode(MatterError):
    """Raised while a camera privacy switch forbids the session or the snapshot.

    ``modes`` names every switch that forbids the call, spelled as ``camera_get_capabilities``'
    ``privacy`` spells it; ``device_status`` is the one status the camera answered for all of them.
    It is a device state, not something the request can change.
    """

    error_code = 106

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` into typed attributes."""
        parsed, message = _parse_details(details, "Camera privacy mode is enabled")
        self.modes: list[str] = _str_list(parsed.get("modes"))
        self.device_status: int | None = _optional_int(parsed.get("device_status"))
        super().__init__(message)


def _parse_details(details: str | None, fallback_message: str) -> tuple[dict[str, Any], str]:
    """Return the JSON object in `details` (empty if it holds none) and the message to raise with.

    Plain-text details are the message; a JSON object supplies its own `message`.
    """
    if not details:
        return {}, fallback_message
    try:
        parsed = json.loads(details)
    except (json.JSONDecodeError, TypeError):
        return {}, details
    if not isinstance(parsed, dict):
        return {}, details
    message = parsed.get("message")
    return parsed, message if isinstance(message, str) and message else fallback_message


def _optional_int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _optional_str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _int_list(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, int) and not isinstance(item, bool)]


def _str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _bound(value: Any) -> CameraStreamIncompatibleBound | None:
    if not isinstance(value, dict):
        return None
    field, requested, limit = (_optional_str(value.get(key)) for key in ("field", "requested", "limit"))
    if field is None or requested is None or limit is None:
        return None
    return CameraStreamIncompatibleBound(field=field, requested=requested, limit=limit)


def _occupying_stream(value: Any) -> CameraOccupyingStream | None:
    if not isinstance(value, dict):
        return None
    kind = _optional_str(value.get("kind"))
    stream_id = _optional_int(value.get("stream_id"))
    reference_count = _optional_int(value.get("reference_count"))
    if kind is None or stream_id is None or reference_count is None:
        return None
    return CameraOccupyingStream(kind=kind, stream_id=stream_id, reference_count=reference_count)


def exception_from_error_code(error_code: int) -> type[MatterError]:
    """Return correct Exception class from error_code."""
    return ERROR_MAP.get(error_code, MatterError)
