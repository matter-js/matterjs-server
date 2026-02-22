"""MatterIntEnum - IntEnum with kUnknownEnumValue fallback.

Reimplements the chip SDK's MatterIntEnum without the aenum dependency.
"""

from enum import IntEnum
from threading import Lock

_map_missing_enum_to_unknown_enum_value = True
_placeholder_count_lock = Lock()
_placeholder_count = 0


class MatterIntEnum(IntEnum):
    """Matter implementation of integer enum with unknown-value fallback."""

    @classmethod
    def _missing_(cls, value):
        if _map_missing_enum_to_unknown_enum_value:
            return cls.kUnknownEnumValue
        return None

    @classmethod
    def extend_enum_if_value_doesnt_exist(cls, value):
        try:
            return_value = cls(value)
        except ValueError:
            return_value = None

        if return_value is None or return_value.value != value:
            global _placeholder_count_lock
            global _placeholder_count
            with _placeholder_count_lock:
                name = f"kUnknownPlaceholder{_placeholder_count}"
                _placeholder_count += 1
                # Dynamically add the new member to the enum
                new_member = int.__new__(cls, value)
                new_member._name_ = name
                new_member._value_ = value
                cls._member_map_[name] = new_member
                cls._value2member_map_[value] = new_member
                return_value = new_member

        return return_value


def set_map_missing_enum_to_unknown_enum_value(value: bool):
    """Sets flag that handles what to do on unknown enum value type."""
    global _map_missing_enum_to_unknown_enum_value
    _map_missing_enum_to_unknown_enum_value = value
