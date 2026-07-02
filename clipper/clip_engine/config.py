"""Central configuration & tuning knobs for the clip engine.

Everything a home user might reasonably want to tweak lives here so the
rest of the code stays readable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


# --- Clip length / selection defaults -------------------------------------

MAX_CLIP_SECONDS = 60.0        # hard ceiling requested by the user (max 1 min)
MIN_CLIP_SECONDS = 15.0        # anything shorter rarely makes a good short
DEFAULT_NUM_CLIPS = 6          # how many highlights to export by default
PAUSE_SPLIT_SECONDS = 1.4      # a silence longer than this starts a new window


# --- "Best part" scoring --------------------------------------------------
# These word lists bias the highlight picker towards attention-grabbing
# moments (hooks). Kept bilingual FR/EN because the user writes in French.

HOOK_WORDS: List[str] = [
    # French
    "secret", "erreur", "astuce", "attention", "voici", "comment", "pourquoi",
    "jamais", "toujours", "incroyable", "surtout", "important", "gratuit",
    "argent", "arnaque", "meilleur", "pire", "personne", "révèle", "découvre",
    "résultat", "solution", "problème", "conseil", "faut", "vraiment",
    # English
    "secret", "mistake", "tip", "warning", "here", "how", "why", "never",
    "always", "incredible", "free", "money", "best", "worst", "nobody",
    "reveal", "discover", "result", "solution", "problem", "advice",
    "actually", "truth", "hack", "biggest", "million", "billion",
]

# Words that signal a strong emotional / punchy moment.
EMPHASIS_WORDS: List[str] = [
    "wow", "incroyable", "fou", "dingue", "énorme", "génial", "parfait",
    "amazing", "crazy", "huge", "insane", "unbelievable", "shocking",
]


# Virality label thresholds (0-100), OpusClip-style.
VIRAL_THRESHOLD = 80
GOOD_THRESHOLD = 60


def virality_label(score: int) -> str:
    if score >= VIRAL_THRESHOLD:
        return "🔥 Viral"
    if score >= GOOD_THRESHOLD:
        return "👍 Bon"
    return "Moyen"


@dataclass
class RenderOptions:
    """How each exported clip should look."""

    aspect: str = "9:16"          # "9:16", "1:1", or "original"
    fill: str = "track"           # "track" (face follow), "blur", or "crop"
    captions: bool = True         # burn TikTok/OpusClip-style subtitles
    caption_style: str = "karaoke"  # "karaoke" (word-by-word) or "plain"
    caption_words_per_line: int = 4
    font_size: int = 20           # relative to a 1080-wide canvas
    crf: int = 20                 # x264 quality (lower = better/bigger)
    preset: str = "veryfast"


@dataclass
class ClipJobConfig:
    """All parameters for a single clipping job."""

    num_clips: int = DEFAULT_NUM_CLIPS
    max_seconds: float = MAX_CLIP_SECONDS
    min_seconds: float = MIN_CLIP_SECONDS
    model_size: str = "base"      # faster-whisper model: tiny/base/small/medium
    language: str | None = None   # None = auto-detect
    render: RenderOptions = field(default_factory=RenderOptions)
