"""Matter Exceptions."""

from __future__ import annotations

import json

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

    _FALLBACK_MESSAGE = "ICD registration rejected: the peer has administrator fabrics from other vendors"

    def __init__(self, details: str | None = None) -> None:
        """Parse `details` and expose `admin_vendor_ids`."""
        self.admin_vendor_ids: list[int] = []
        message = details if details else self._FALLBACK_MESSAGE
        if details:
            try:
                parsed = json.loads(details)
            except (json.JSONDecodeError, TypeError):
                parsed = None
            if isinstance(parsed, dict):
                vendor_ids = parsed.get("admin_vendor_ids")
                if isinstance(vendor_ids, list):
                    self.admin_vendor_ids = vendor_ids
                parsed_message = parsed.get("message")
                message = (
                    parsed_message
                    if isinstance(parsed_message, str) and parsed_message
                    else self._FALLBACK_MESSAGE
                )
        super().__init__(message)


def exception_from_error_code(error_code: int) -> type[MatterError]:
    """Return correct Exception class from error_code."""
    return ERROR_MAP.get(error_code, MatterError)
