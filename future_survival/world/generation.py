"""Deterministic terrain generation for the initial playable world."""

from __future__ import annotations

import math
import random

from .chunk import VoxelChunk

GRASS = 1
DIRT = 2
STONE = 3
BEDROCK = 4


class WorldGenerator:
    """Generate a small, seeded voxel terrain chunk."""

    def __init__(
        self,
        seed: int,
        width: int = 32,
        height: int = 20,
        depth: int = 10,
    ) -> None:
        if width <= 0 or height < 3 or depth <= 0:
            raise ValueError("world width/depth must be positive and height at least 3")
        self.seed = seed
        self.width = width
        self.height = height
        self.depth = depth

    def generate(self) -> VoxelChunk:
        """Create a layered terrain chunk with reproducible rolling hills."""
        chunk = VoxelChunk(self.width, self.height, self.depth)
        noise = random.Random(self.seed)

        for x in range(self.width):
            for z in range(self.depth):
                surface_y = round(
                    self.height * 0.32
                    + math.sin(x * 0.31) * self.height * 0.09
                    + math.cos(z * 0.47) * self.height * 0.06
                    + math.sin((x + z) * 0.17) * self.height * 0.04
                    + noise.choice((-1, 0, 0, 1))
                )
                surface_y = max(1, min(self.height - 1, surface_y))

                for y in range(surface_y + 1):
                    if y == 0:
                        block_id = BEDROCK
                    elif y == surface_y:
                        block_id = GRASS
                    elif y >= surface_y - 3:
                        block_id = DIRT
                    else:
                        block_id = STONE
                    chunk.set(x, y, z, block_id)

        return chunk
