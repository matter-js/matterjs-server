"""Several helpers for the WebSockets API."""

from __future__ import annotations

from collections.abc import Callable, Coroutine
from dataclasses import MISSING, dataclass
import inspect
from typing import Any, get_type_hints

from matter_server.common.helpers.util import parse_value


@dataclass
class APICommandHandler:
    """Model for an API command handler."""

    command: str
    signature: inspect.Signature
    type_hints: dict[str, Any]
    target: Callable[..., Coroutine[Any, Any, Any]]

    @classmethod
    def parse(
        cls, command: str, func: Callable[..., Coroutine[Any, Any, Any]]
    ) -> APICommandHandler:
        """Parse APICommandHandler by providing a function."""
        return APICommandHandler(
            command=command,
            signature=inspect.signature(func),
            type_hints=get_type_hints(func),
            target=func,
        )


def api_command[F: Callable[..., Any]](command: str) -> Callable[[F], F]:
    """Decorate a function as API route/command."""

    def decorate(func: F) -> F:
        func.api_cmd = command  # type: ignore[attr-defined]
        return func

    return decorate


def parse_arguments(
    func_sig: inspect.Signature,
    func_types: dict[str, Any],
    args: dict | None = None,
    strict: bool = False,
) -> dict[str, Any]:
    """Parse (and convert) incoming arguments to correct types."""
    if args is None:
        args = {}
    final_args = {}
    # ignore extra args if not strict
    if strict:
        for key, value in args.items():
            if key not in func_sig.parameters:
                raise KeyError(f"Invalid parameter: '{key}'")
    # parse arguments to correct type
    for name, param in func_sig.parameters.items():
        value = args.get(name)
        default = MISSING if param.default is inspect.Parameter.empty else param.default
        final_args[name] = parse_value(name, value, func_types[name], default)
    return final_args
