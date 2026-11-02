import unittest

from future_survival.renderer.renderer import IsometricProjection
from future_survival.world.chunk import VoxelChunk
from future_survival.world.generation import BEDROCK, DIRT, GRASS, WorldGenerator


class WorldGenerationTests(unittest.TestCase):
    def test_seed_produces_repeatable_world(self) -> None:
        first = list(WorldGenerator(seed=23, width=8, height=10, depth=5).generate().iter_blocks())
        second = list(WorldGenerator(seed=23, width=8, height=10, depth=5).generate().iter_blocks())

        self.assertEqual(first, second)
        self.assertTrue(any(block_id == GRASS for _, _, _, block_id in first))
        self.assertTrue(any(block_id == DIRT for _, _, _, block_id in first))
        self.assertTrue(any(block_id == BEDROCK for _, _, _, block_id in first))

    def test_world_generation_respects_chunk_bounds(self) -> None:
        chunk = WorldGenerator(seed=17, width=5, height=3, depth=4).generate()

        self.assertTrue(len(chunk) > 0)
        self.assertTrue(all(chunk.in_bounds(x, y, z) for x, y, z, _ in chunk.iter_blocks()))

    def test_projection_builds_visible_faces_at_chunk_edges(self) -> None:
        chunk = VoxelChunk(width=1, height=1, depth=1)
        chunk.set(0, 0, 0, GRASS)

        faces = IsometricProjection.fit(chunk, (640, 480)).block_faces(chunk)

        self.assertEqual(len(faces), 3)
        self.assertEqual({normal for _, normal, _, _ in faces}, {(0, 1, 0), (1, 0, 0), (0, 0, 1)})


if __name__ == "__main__":
    unittest.main()
