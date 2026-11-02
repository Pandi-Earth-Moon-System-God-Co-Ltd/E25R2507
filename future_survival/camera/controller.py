"""Stable camera contract for the fixed side-view follow camera."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class CameraState:
    """Placeholder state; projection/view math is intentionally not implemented yet."""

    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0


class SideFollowCamera:
    def __init__(self, state: CameraState | None = None) -> None:
        self.state = state or CameraState()

    def follow(self, target_x: float, target_y: float) -> None:
        """Record a future follow target; smoothing and matrices come later."""
        self.state.x = target_x
        self.state.y = target_y

    def move_to(self, x: float, y: float) -> None:
        """Set the camera center directly."""
        self.state.x = float(x)
        self.state.y = float(y)

    def pan(self, dx: float, dy: float) -> None:
        """Offset the camera position by a delta."""
        self.state.x += float(dx)
        self.state.y += float(dy)

    def reset(self, x: float = 0.0, y: float = 0.0, zoom: float = 1.0) -> None:
        """Reset the camera to a known state."""
        self.state.x = float(x)
        self.state.y = float(y)
        self.state.zoom = float(zoom)

    def look_at(self, target_x: float, target_y: float) -> None:
        """Alias for follow for call sites that read like a camera look operation."""
        self.follow(target_x, target_y)

