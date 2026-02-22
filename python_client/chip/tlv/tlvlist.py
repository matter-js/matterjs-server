"""TLVList - ordered list of tag-value pairs for TLV path encoding."""

from __future__ import annotations

import dataclasses
import enum
from typing import Any, Iterator, List, Tuple, Union


class TLVList:
    """Represents a list in CHIP TLV."""

    @dataclasses.dataclass
    class TLVListItem:
        tag: Union[None, int]
        value: Any

        def as_tuple(self):
            return (self.tag, self.value)

    class IndexMethod(enum.Enum):
        Index = 0
        Tag = 1

    class _Iterator:
        def __init__(self, it: Iterator):
            self._iterator = it

        def __iter__(self):
            return self

        def __next__(self):
            res = next(self._iterator)
            return res.tag, res.value

    def __init__(self, items: List[Tuple[Union[int, None], Any]] = []):
        self._data: List[TLVList.TLVListItem] = []
        for tag, val in items:
            self.append(tag, val)

    def _get_item_by_tag(self, tag) -> Any:
        if not isinstance(tag, int):
            raise ValueError("Tag should be an integer for non-anonymous fields.")
        for data in self._data:
            if data.tag == tag:
                return data.value
        raise KeyError(f"Tag {tag} not found in the list.")

    def __getitem__(self, access) -> Any:
        if isinstance(access, slice):
            tag, index = access.start, access.stop
            if tag == TLVList.IndexMethod.Tag:
                return self._get_item_by_tag(index)
            elif tag == TLVList.IndexMethod.Index:
                return self._data[index].as_tuple()
            raise ValueError(
                "Method should be TLVList.IndexMethod.Tag or TLVList.IndexMethod.Index"
            )
        elif isinstance(access, int):
            return self._get_item_by_tag(access)
        raise ValueError("Invalid access method")

    def append(self, tag: Union[None, int], value: Any) -> None:
        if (tag is not None) and (not isinstance(tag, int)):
            raise KeyError(
                f"Tag should be an integer or none for anonymous tag, {type(tag)} got"
            )
        self._data.append(TLVList.TLVListItem(tag, value))

    def __iter__(self):
        return TLVList._Iterator(iter(self._data))

    def __eq__(self, rhs: object) -> bool:
        if not isinstance(rhs, TLVList):
            return False
        return self._data == rhs._data

    def __repr__(self):
        return "TLVList" + repr(self._data)
