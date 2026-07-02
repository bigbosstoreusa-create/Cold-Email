"""Turn a transcript into ranked highlight windows (the "best parts").

Strategy, entirely offline & explainable:

1. Group consecutive transcript segments into candidate *windows* that
   respect the max clip length and break on long pauses / sentence ends.
2. Score every window with a transparent heuristic combining:
     - hook / emphasis vocabulary (attention grabbing openings),
     - questions and numbers (curiosity + specificity),
     - speech energy (words per second),
     - a mild preference for a satisfying length.
3. Greedily select the top non-overlapping windows.

An optional LLM re-ranker can be plugged in (see ``score_with_llm``) but is
never required.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from .config import (
    EMPHASIS_WORDS,
    HOOK_WORDS,
    PAUSE_SPLIT_SECONDS,
)
from .transcribe import Segment

_HOOKS = {w.lower() for w in HOOK_WORDS}
_EMPH = {w.lower() for w in EMPHASIS_WORDS}
_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


# Common stop-words filtered out when auto-generating hashtags.
_STOP = {
    "the", "and", "for", "you", "your", "that", "this", "with", "have", "are",
    "was", "but", "not", "les", "des", "une", "que", "qui", "pas", "vous",
    "pour", "dans", "est", "sur", "avec", "plus", "son", "ses", "cette",
    "the", "will", "can", "all", "one", "get", "got", "just", "like", "know",
    "c'est", "il", "elle", "nous", "ont", "fait", "faire", "tout", "tous",
}


@dataclass
class Highlight:
    start: float
    end: float
    text: str
    score: float
    segments: List[Segment]

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)

    def virality(self) -> int:
        """Absolute 0-100 "virality" score, OpusClip-style."""
        return virality_score(self)

    def hashtags(self, k: int = 4) -> List[str]:
        """Auto hashtags from the most salient content words."""
        freq: dict[str, int] = {}
        for tok in (t.lower() for t in _WORD_RE.findall(self.text)):
            if len(tok) < 4 or tok in _STOP:
                continue
            weight = 3 if tok in _HOOKS else 1
            freq[tok] = freq.get(tok, 0) + weight
        top = sorted(freq, key=lambda w: freq[w], reverse=True)[:k]
        return ["#" + t for t in top]

    def title(self, max_len: int = 60) -> str:
        """A short, human title derived from the opening sentence."""
        text = self.text.strip()
        if not text:
            return f"Extrait {int(self.start // 60):02d}:{int(self.start % 60):02d}"
        first = re.split(r"(?<=[.!?])\s+", text)[0]
        first = first.strip().strip('"').strip()
        if len(first) > max_len:
            first = first[: max_len - 1].rsplit(" ", 1)[0] + "…"
        return first[:1].upper() + first[1:]


def build_windows(
    segments: List[Segment],
    max_seconds: float,
    min_seconds: float,
) -> List[Highlight]:
    """Generate candidate windows that may *start* at any segment.

    Unlike a single greedy pass, we consider a window beginning at every
    segment and grow it up to ``max_seconds`` (stopping at a long pause so
    clips end cleanly). This lets a highlight open right on a hook instead of
    inheriting a dull intro, which is what makes shorts feel punchy.
    """
    windows: List[Highlight] = []
    n = len(segments)
    floor = min(min_seconds, 3.0)

    for i in range(n):
        group: List[Segment] = [segments[i]]
        for j in range(i + 1, n):
            gap = segments[j].start - segments[j - 1].end
            span = segments[j].end - segments[i].start
            if span > max_seconds:
                break
            if gap > PAUSE_SPLIT_SECONDS:
                # A long silence is a natural clip boundary — stop growing.
                break
            group.append(segments[j])

        start, end = group[0].start, group[-1].end
        if end - start >= floor:
            text = " ".join(s.text for s in group if s.text).strip()
            windows.append(Highlight(start, end, text, 0.0, list(group)))

    return windows


def _score_text(text: str) -> float:
    tokens = [t.lower() for t in _WORD_RE.findall(text)]
    if not tokens:
        return 0.0
    n = len(tokens)
    hooks = sum(1 for t in tokens if t in _HOOKS)
    emph = sum(1 for t in tokens if t in _EMPH)
    has_question = 1.0 if "?" in text else 0.0
    has_number = 1.0 if re.search(r"\d", text) else 0.0

    # Normalise per-word so long windows are not unfairly favoured.
    density = (2.5 * hooks + 2.0 * emph) / n
    return (
        6.0 * density
        + 1.2 * has_question
        + 0.8 * has_number
    )


def score_window(h: Highlight, max_seconds: float, min_seconds: float) -> float:
    text_score = _score_text(h.text)

    # Speech energy: words per second (capped so fast talkers don't dominate).
    word_count = len(_WORD_RE.findall(h.text))
    wps = word_count / h.duration if h.duration else 0.0
    energy = min(wps / 3.0, 1.0)

    # A gentle bump for the opening sentence carrying a hook.
    opener = h.text.split(".")[0] if h.text else ""
    opener_bonus = 0.6 if _score_text(opener) > 0.4 else 0.0

    # Prefer clips comfortably inside [min, max] rather than tiny slivers.
    ideal = (min_seconds + max_seconds) / 2.0
    length_fit = 1.0 - min(abs(h.duration - ideal) / max_seconds, 1.0)

    return text_score + 1.5 * energy + opener_bonus + 0.8 * length_fit


def virality_score(h: Highlight) -> int:
    """Map the transcript signals onto a stable, absolute 0-100 scale.

    Unlike ``score_window`` (used only for *relative* ranking), this uses
    capped components so a clip's score doesn't depend on the other clips —
    the way OpusClip shows an absolute number per clip.
    """
    tokens = [t.lower() for t in _WORD_RE.findall(h.text)]
    n = len(tokens) or 1
    hooks = sum(1 for t in tokens if t in _HOOKS)
    emph = sum(1 for t in tokens if t in _EMPH)

    hook_pts = min(hooks / max(n / 15, 1), 1.0) * 38      # up to 38
    emph_pts = min(emph / max(n / 25, 1), 1.0) * 12       # up to 12
    question_pts = 12 if "?" in h.text else 0             # curiosity
    number_pts = 8 if re.search(r"\d", h.text) else 0     # specificity

    wps = len(tokens) / h.duration if h.duration else 0.0
    energy_pts = min(wps / 3.0, 1.0) * 18                 # up to 18

    ideal = 35.0
    fit = 1.0 - min(abs(h.duration - ideal) / 45.0, 1.0)
    length_pts = fit * 12                                 # up to 12

    raw = hook_pts + emph_pts + question_pts + number_pts + energy_pts + length_pts
    # Gentle floor so even quiet clips read as plausible (like OpusClip's ~40s).
    score = 42 + raw * 0.58
    return int(max(0, min(100, round(score))))


def rank_highlights(
    segments: List[Segment],
    num_clips: int,
    max_seconds: float,
    min_seconds: float,
) -> List[Highlight]:
    windows = build_windows(segments, max_seconds, min_seconds)
    for w in windows:
        w.score = score_window(w, max_seconds, min_seconds)

    # Greedy non-overlapping selection by score.
    windows.sort(key=lambda w: w.score, reverse=True)
    chosen: List[Highlight] = []
    for w in windows:
        if all(w.end <= c.start or w.start >= c.end for c in chosen):
            chosen.append(w)
        if len(chosen) >= num_clips:
            break

    # Return in chronological order for a tidy gallery.
    chosen.sort(key=lambda w: w.start)
    return chosen
