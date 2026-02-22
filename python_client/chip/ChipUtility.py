"""Minimal reimplementation of chip.ChipUtility for matter-python-client."""


class classproperty(property):
    """Descriptor that works like @classmethod + @property combined."""

    def __get__(self, cls, owner):
        return classmethod(self.fget).__get__(None, owner)()
