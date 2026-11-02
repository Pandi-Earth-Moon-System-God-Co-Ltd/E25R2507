"""Voxel chunk data model; rendering and persistence are separate concerns."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field


@dataclass(slots=True)
class VoxelChunk:
    """A bounded voxel container ready for future mining/placing systems."""

    width: int = 16
    height: int = 64
    depth: int = 16
    _blocks: dict[tuple[int, int, int], int] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0 or self.depth <= 0:
            raise ValueError("chunk dimensions must all be positive")

    def __len__(self) -> int:
        return len(self._blocks)

    def __contains__(self, coord: tuple[int, int, int]) -> bool:
        x, y, z = coord
        try:
            self._validate(x, y, z)
        except IndexError:
            return False
        return (x, y, z) in self._blocks

    def __getitem__(self, coord: tuple[int, int, int]) -> int:
        x, y, z = coord
        return self.get(x, y, z)

    def __setitem__(self, coord: tuple[int, int, int], block_id: int) -> None:
        x, y, z = coord
        self.set(x, y, z, block_id)

    def get(self, x: int, y: int, z: int) -> int:
        self._validate(x, y, z)
        return self._blocks.get((x, y, z), 0)

    def set(self, x: int, y: int, z: int, block_id: int) -> None:
        self._validate(x, y, z)
        if block_id < 0:
            raise ValueError("block_id must be non-negative")
        key = (x, y, z)
        if block_id == 0:
            self._blocks.pop(key, None)
        else:
            self._blocks[key] = block_id

    def remove(self, x: int, y: int, z: int) -> int:
        """Remove a block and return the previous block id, or 0 if empty."""
        previous = self.get(x, y, z)
        self.set(x, y, z, 0)
        return previous

    def clear(self) -> None:
        self._blocks.clear()

    def has_block(self, x: int, y: int, z: int) -> bool:
        return self.get(x, y, z) != 0

    def iter_blocks(self) -> Iterator[tuple[int, int, int, int]]:
        """Yield (x, y, z, block_id) pairs for all non-empty voxels."""
        for (x, y, z), block_id in self._blocks.items():
            yield x, y, z, block_id

    def in_bounds(self, x: int, y: int, z: int) -> bool:
        """Return whether a coordinate belongs to this chunk."""
        return 0 <= x < self.width and 0 <= y < self.height and 0 <= z < self.depth

    def _validate(self, x: int, y: int, z: int) -> None:
        if not self.in_bounds(x, y, z):
            raise IndexError("voxel coordinate is outside this chunk")
