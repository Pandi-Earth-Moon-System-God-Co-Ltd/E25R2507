"""Central runtime configuration for the first playable shell."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class GameConfig:
    window_width: int = 1280
    window_height: int = 720
    window_title: str = "Future Survival"
    target_fps: int = 60
    world_seed: int = 17
    world_width: int = 32
    world_height: int = 20
    world_depth: int = 10
    gl_major: int = 3
    gl_minor: int = 3
    clear_color: tuple[float, float, float, float] = (0.035, 0.055, 0.085, 1.0)

    def __post_init__(self) -> None:
        if self.window_width <= 0:
            raise ValueError("window_width must be positive")
        if self.window_height <= 0:
            raise ValueError("window_height must be positive")
        if self.target_fps <= 0:
            raise ValueError("target_fps must be positive")
        if self.world_width <= 0 or self.world_height < 3 or self.world_depth <= 0:
            raise ValueError("world width/depth must be positive and height at least 3")
        if self.gl_major < 0 or self.gl_minor < 0:
            raise ValueError("OpenGL version numbers must be non-negative")
        if len(self.clear_color) not in (3, 4):
            raise ValueError("clear_color must contain 3 or 4 float channel values")
        if not 0.0 <= self.clear_color[0] <= 1.0:
            raise ValueError("clear_color red channel must be between 0.0 and 1.0")
        if not 0.0 <= self.clear_color[1] <= 1.0:
            raise ValueError("clear_color green channel must be between 0.0 and 1.0")
        if not 0.0 <= self.clear_color[2] <= 1.0:
            raise ValueError("clear_color blue channel must be between 0.0 and 1.0")
        if len(self.clear_color) == 4 and not 0.0 <= self.clear_color[3] <= 1.0:
            raise ValueError("clear_color alpha channel must be between 0.0 and 1.0")
