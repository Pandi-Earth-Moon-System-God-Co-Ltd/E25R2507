"""World and voxel data boundaries."""

from importlib import import_module

__all__ = ["VoxelChunk", "WorldGenerator", "GRASS", "DIRT", "STONE", "BEDROCK"]


def __getattr__(name: str):
    if name == "VoxelChunk":
        return getattr(import_module(".chunk", __name__), name)
    if name in {"WorldGenerator", "GRASS", "DIRT", "STONE", "BEDROCK"}:
        return getattr(import_module(".generation", __name__), name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
