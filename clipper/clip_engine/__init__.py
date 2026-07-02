"""OpusClip-style local highlight clipper engine."""

from .config import ClipJobConfig, RenderOptions
from .pipeline import ClipResult, run

__all__ = ["ClipJobConfig", "RenderOptions", "ClipResult", "run"]
