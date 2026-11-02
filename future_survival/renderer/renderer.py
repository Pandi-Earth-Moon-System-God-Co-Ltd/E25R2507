"""ModernGL renderer and a lightweight isometric voxel view."""

from __future__ import annotations

from array import array
from dataclasses import dataclass

import moderngl
import pygame

from ..config import GameConfig
from ..world.chunk import VoxelChunk
from ..world.generation import BEDROCK, DIRT, GRASS, STONE
from .context import GraphicsContext

Color = tuple[float, float, float]
Point = tuple[float, float]
Face = tuple[
    tuple[int, int, int],
    tuple[int, int, int],
    tuple[Point, ...],
    Color,
]

BLOCK_COLORS: dict[int, Color] = {
    GRASS: (0.32, 0.72, 0.25),
    DIRT: (0.52, 0.32, 0.19),
    STONE: (0.48, 0.52, 0.57),
    BEDROCK: (0.22, 0.25, 0.30),
}


@dataclass(frozen=True, slots=True)
class IsometricProjection:
    """Convert voxel coordinates to screen-space diamond tiles."""

    tile_width: float
    tile_depth: float
    block_height: float
    origin_x: float
    origin_y: float

    @classmethod
    def fit(
        cls, chunk: VoxelChunk, viewport: tuple[int, int]
    ) -> IsometricProjection:
        width, height = viewport
        highest_block = max(
            (y + 1 for _, y, _, _ in chunk.iter_blocks()), default=1
        )
        horizontal_span = chunk.width + chunk.depth
        vertical_span = highest_block * 0.7 + horizontal_span * 0.25
        tile_width = min(
            36.0,
            max(1.0, (width - 32) * 2.0 / horizontal_span),
            max(1.0, (height - 32) / vertical_span),
        )
        tile_depth = tile_width * 0.5
        block_height = tile_width * 0.7
        projected_top = -highest_block * block_height - tile_depth * 0.5
        projected_bottom = (
            (horizontal_span - 2) * tile_depth * 0.5 + tile_depth * 0.5
        )
        origin_y = height * 0.5 - (projected_top + projected_bottom) * 0.5
        return cls(tile_width, tile_depth, block_height, width * 0.5, origin_y)

    def top_center(self, x: int, y: int, z: int) -> Point:
        return (
            self.origin_x + (x - z) * self.tile_width * 0.5,
            self.origin_y + (x + z) * self.tile_depth * 0.5 - y * self.block_height,
        )

    def block_faces(self, chunk: VoxelChunk) -> list[Face]:
        faces: list[Face] = []
        for x, y, z, block_id in sorted(
            chunk.iter_blocks(), key=lambda block: (block[0] + block[2], block[1])
        ):
            cx, cy = self.top_center(x, y, z)
            half_width = self.tile_width * 0.5
            half_depth = self.tile_depth * 0.5
            top = (cx, cy - half_depth)
            right = (cx + half_width, cy)
            bottom = (cx, cy + half_depth)
            left = (cx - half_width, cy)
            bottom_offset = (0.0, self.block_height)
            color = BLOCK_COLORS.get(block_id, (0.75, 0.2, 0.75))

            if not chunk.in_bounds(x, y + 1, z) or not chunk.has_block(x, y + 1, z):
                faces.append(((x, y, z), (0, 1, 0), (top, right, bottom, left), color))
            if not chunk.in_bounds(x + 1, y, z) or not chunk.has_block(x + 1, y, z):
                faces.append(
                    (
                        (x, y, z),
                        (1, 0, 0),
                        (
                            right,
                            bottom,
                            (bottom[0], bottom[1] + bottom_offset[1]),
                            (right[0], right[1] + bottom_offset[1]),
                        ),
                        tuple(channel * 0.72 for channel in color),
                    )
                )
            if not chunk.in_bounds(x, y, z + 1) or not chunk.has_block(x, y, z + 1):
                faces.append(
                    (
                        (x, y, z),
                        (0, 0, 1),
                        (
                            bottom,
                            left,
                            (left[0], left[1] + bottom_offset[1]),
                            (bottom[0], bottom[1] + bottom_offset[1]),
                        ),
                        tuple(channel * 0.52 for channel in color),
                    )
                )
        return faces


class Renderer:
    def __init__(self, graphics: GraphicsContext, config: GameConfig) -> None:
        self._graphics = graphics
        self._clear_color = config.clear_color
        self._program = graphics.ctx.program(
            vertex_shader="""
                #version 330
                in vec2 in_position;
                in vec3 in_color;
                out vec3 vertex_color;
                void main() {
                    gl_Position = vec4(in_position, 0.0, 1.0);
                    vertex_color = in_color;
                }
            """,
            fragment_shader="""
                #version 330
                in vec3 vertex_color;
                out vec4 fragment_color;
                void main() {
                    fragment_color = vec4(vertex_color, 1.0);
                }
            """,
        )
        self._vertex_buffer = graphics.ctx.buffer(reserve=4, dynamic=True)
        self._vertex_array = graphics.ctx.vertex_array(
            self._program,
            [(self._vertex_buffer, "2f 3f", "in_position", "in_color")],
        )
        self._faces: list[Face] = []
        graphics.ctx.disable(moderngl.DEPTH_TEST)

    @property
    def graphics(self) -> GraphicsContext:
        return self._graphics

    def set_clear_color(self, color: tuple[float, float, float, float]) -> None:
        if len(color) != 4:
            raise ValueError("clear color requires RGBA values")
        self._clear_color = tuple(float(channel) for channel in color)

    def resize(self, width: int, height: int) -> None:
        if width <= 0 or height <= 0:
            raise ValueError("viewport dimensions must be positive")
        pygame.display.set_mode((width, height), pygame.OPENGL | pygame.DOUBLEBUF)

    def begin_frame(self) -> None:
        self._graphics.ctx.clear(*self._clear_color)

    def draw_world(
        self, chunk: VoxelChunk, selected: tuple[int, int, int] | None = None
    ) -> None:
        viewport = pygame.display.get_surface().get_size()
        self._graphics.ctx.viewport = (0, 0, *viewport)
        projection = IsometricProjection.fit(chunk, viewport)
        self._faces = projection.block_faces(chunk)

        vertex_data = array("f")
        for coord, _, polygon, color in self._faces:
            if coord == selected:
                color = tuple(min(1.0, channel * 1.35 + 0.12) for channel in color)
            first = polygon[0]
            for index in range(1, len(polygon) - 1):
                for point in (first, polygon[index], polygon[index + 1]):
                    vertex_data.extend(
                        (
                            point[0] * 2.0 / viewport[0] - 1.0,
                            1.0 - point[1] * 2.0 / viewport[1],
                            *color,
                        )
                    )

        if not vertex_data:
            return
        data = vertex_data.tobytes()
        self._vertex_buffer.orphan(len(data))
        self._vertex_buffer.write(data)
        self._vertex_array.render(
            mode=moderngl.TRIANGLES, vertices=len(vertex_data) // 5
        )

    def pick_block(
        self, point: tuple[int, int]
    ) -> tuple[tuple[int, int, int], tuple[int, int, int]] | None:
        """Return the visible block and face normal at a screen position."""
        for coord, normal, polygon, _ in reversed(self._faces):
            if _point_in_polygon(point, polygon):
                return coord, normal
        return None

    def end_frame(self) -> None:
        pygame.display.flip()

    def close(self) -> None:
        self._vertex_array.release()
        self._vertex_buffer.release()
        self._program.release()


def _point_in_polygon(point: tuple[int, int], polygon: tuple[Point, ...]) -> bool:
    x, y = point
    inside = False
    previous_x, previous_y = polygon[-1]
    for current_x, current_y in polygon:
        if (current_y > y) != (previous_y > y):
            crossing_x = (previous_x - current_x) * (y - current_y) / (
                previous_y - current_y
            ) + current_x
            if x < crossing_x:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside
