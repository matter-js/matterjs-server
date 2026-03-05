"""Minimal reimplementation of chip.ChipUtility for matter-python-client."""


class classproperty(property):
    """Descriptor that works like @classmethod + @property combined.

    Results are cached per owner class. All cluster property values are
    compile-time constants, so caching eliminates repeated classmethod wrapper
    allocation and expensive make_dataclass() calls from _cluster_object.
    """

    def __get__(self, obj, owner):
        try:
            return self._cache[owner]  # type: ignore[attr-defined]
        except AttributeError:
            self._cache: dict = {}  # type: ignore[misc]
        except KeyError:
            pass
        value = classmethod(self.fget).__get__(None, owner)()
        self._cache[owner] = value
        return value
