"""Application orchestration: lifecycle, input, timing, and frame ownership."""

from __future__ import annotations

import sys

import pygame

from .config import GameConfig
from .renderer.context import GraphicsContext
from .renderer.renderer import Renderer
from .world.generation import DIRT, GRASS, STONE, WorldGenerator


def run(config: GameConfig | None = None) -> int:
    """Run the playable voxel-world prototype and return a process-style exit code."""
    config = config or GameConfig()
    pygame.init()
    graphics: GraphicsContext | None = None
    renderer: Renderer | None = None
    try:
        graphics = GraphicsContext.create(config)
        renderer = Renderer(graphics, config)
        world = WorldGenerator(
            config.world_seed,
            config.world_width,
            config.world_height,
            config.world_depth,
        ).generate()
        selected_block: tuple[int, int, int] | None = None
        selected_block_type = DIRT
        clock = pygame.time.Clock()
        running = True

        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key in (pygame.K_ESCAPE, pygame.K_q):
                        running = False
                    elif event.key == pygame.K_1:
                        selected_block_type = GRASS
                    elif event.key == pygame.K_2:
                        selected_block_type = DIRT
                    elif event.key == pygame.K_3:
                        selected_block_type = STONE
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    hit = renderer.pick_block(event.pos)
                    if hit is None:
                        continue
                    coord, normal = hit
                    if event.button == pygame.BUTTON_LEFT:
                        selected_block = coord
                        world.remove(*coord)
                    elif event.button == pygame.BUTTON_RIGHT:
                        destination = tuple(
                            coord[index] + normal[index] for index in range(3)
                        )
                        if world.in_bounds(*destination) and not world.has_block(
                            *destination
                        ):
                            world.set(*destination, selected_block_type)
                            selected_block = destination

            clock.tick(config.target_fps)
            renderer.begin_frame()
            renderer.draw_world(world, selected_block)
            renderer.end_frame()
            fps = clock.get_fps()
            selected_label = (
                f" | Block: {selected_block}" if selected_block is not None else ""
            )
            pygame.display.set_caption(
                f"{config.window_title} | FPS: {fps:5.1f}{selected_label}"
            )

        return 0
    except Exception as exc:
        print(f"Future Survival failed to start: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            if renderer is not None:
                renderer.close()
        finally:
            try:
                if graphics is not None:
                    graphics.close()
            finally:
                pygame.quit()
