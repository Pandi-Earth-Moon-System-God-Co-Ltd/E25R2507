"""Creation and ownership of the Pygame window and ModernGL context."""

from __future__ import annotations

from dataclasses import dataclass

import moderngl
import pygame

from ..config import GameConfig


@dataclass(slots=True)
class GraphicsContext:
    """Owns graphics resources and releases them in one place."""

    ctx: moderngl.Context

    @classmethod
    def create(cls, config: GameConfig) -> "GraphicsContext":
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MAJOR_VERSION, config.gl_major)
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_MINOR_VERSION, config.gl_minor)
        pygame.display.gl_set_attribute(pygame.GL_CONTEXT_PROFILE_MASK, pygame.GL_CONTEXT_PROFILE_CORE)
        pygame.display.set_mode(
            (config.window_width, config.window_height), pygame.OPENGL | pygame.DOUBLEBUF
        )
        try:
            return cls(moderngl.create_context(require=config.gl_major * 100 + config.gl_minor * 10))
        except Exception:
            pygame.display.quit()
            raise

    def close(self) -> None:
        self.ctx.release()
        pygame.display.quit()

