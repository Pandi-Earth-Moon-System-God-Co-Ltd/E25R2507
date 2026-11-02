"""Camera subsystem boundaries."""

from importlib import import_module

__all__ = ["CameraState", "SideFollowCamera"]


def __getattr__(name: str):
    if name in {"CameraState", "SideFollowCamera"}:
        return getattr(import_module(".controller", __name__), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

