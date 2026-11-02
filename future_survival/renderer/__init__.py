"""Rendering subsystem boundaries."""

from importlib import import_module

__all__ = ["GraphicsContext", "Renderer"]


def __getattr__(name: str):
    if name in {"GraphicsContext", "Renderer"}:
        module = import_module(".context", __name__) if name == "GraphicsContext" else import_module(".renderer", __name__)
        return getattr(module, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

