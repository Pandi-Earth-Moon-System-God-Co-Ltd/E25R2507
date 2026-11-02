"""Future Survival game package."""

from __future__ import annotations

from importlib import import_module

__version__ = "0.1.0"

__all__ = [
    "GameConfig",
    "GraphicsContext",
    "Renderer",
    "CameraState",
    "SideFollowCamera",
    "VoxelChunk",
    "WorldGenerator",
    "run",
]


def __getattr__(name: str):
    if name == "GameConfig":
        return import_module(".config", __name__).GameConfig
    if name == "GraphicsContext":
        return import_module(".renderer.context", __name__).GraphicsContext
    if name == "Renderer":
        return import_module(".renderer.renderer", __name__).Renderer
    if name == "CameraState":
        return import_module(".camera.controller", __name__).CameraState
    if name == "SideFollowCamera":
        return import_module(".camera.controller", __name__).SideFollowCamera
    if name == "VoxelChunk":
        return import_module(".world.chunk", __name__).VoxelChunk
    if name == "WorldGenerator":
        return import_module(".world.generation", __name__).WorldGenerator
    if name == "run":
        return import_module(".app", __name__).run
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
