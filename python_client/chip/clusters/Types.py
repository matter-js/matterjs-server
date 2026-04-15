"""Nullable type and NullValue singleton for Matter data model."""


class Nullable:
    def __repr__(self):
        return "Null"

    def __eq__(self, other):
        if isinstance(other, Nullable):
            return True
        return False

    def __ne__(self, other):
        return not self.__eq__(other)

    def __lt__(self, other):
        return True

    def __le__(self, other):
        return True  # self < other or self == other, both are always True for this sentinel

    def __gt__(self, other):
        return False  # negation of __le__

    def __ge__(self, other):
        return isinstance(other, Nullable)  # True when compared to another Nullable, False otherwise

    def __hash__(self):
        return 0


NullValue = Nullable()
