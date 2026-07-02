"""Speech-to-text with word-level timestamps.

Uses faster-whisper when available (fast, local, offline). If it is not
installed we fall back to a naive time-based chunking so the rest of the
pipeline still produces clips (just without smart highlight scoring).
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from typing import Callable, List, Optional


@dataclass
class Word:
    start: float
    end: float
    text: str


@dataclass
class Segment:
    start: float
    end: float
    text: str
    words: List[Word] = field(default_factory=list)

    @property
    def duration(self) -> float:
        return max(0.0, self.end - self.start)


def _media_duration(path: str) -> float:
    """Return media duration in seconds via ffprobe (0 if unknown)."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", path,
            ],
            capture_output=True, text=True, check=True,
        )
        return float(out.stdout.strip())
    except Exception:
        return 0.0


def transcribe(
    video_path: str,
    model_size: str = "base",
    language: Optional[str] = None,
    progress: Optional[Callable[[str, float], None]] = None,
) -> List[Segment]:
    """Transcribe ``video_path`` into timed segments with word timestamps."""

    def report(msg: str, pct: float) -> None:
        if progress:
            progress(msg, pct)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        report("faster-whisper absent : découpage temporel simple", 0.3)
        return _fallback_segments(video_path)

    report(f"Chargement du modèle Whisper ({model_size})…", 0.05)
    # int8 keeps it light enough to run on a normal home CPU.
    model = WhisperModel(model_size, device="auto", compute_type="int8")

    report("Transcription en cours…", 0.1)
    seg_iter, info = model.transcribe(
        video_path,
        language=language,
        word_timestamps=True,
        vad_filter=True,
    )

    total = _media_duration(video_path) or (info.duration if info else 0.0)
    segments: List[Segment] = []
    for s in seg_iter:
        words = [
            Word(w.start, w.end, w.word.strip())
            for w in (s.words or [])
            if w.start is not None and w.end is not None
        ]
        segments.append(Segment(s.start, s.end, s.text.strip(), words))
        if total:
            report("Transcription…", min(0.6, 0.1 + 0.5 * (s.end / total)))

    report("Transcription terminée", 0.6)
    return segments


def _fallback_segments(video_path: str, chunk: float = 45.0) -> List[Segment]:
    """No transcription available: slice the timeline into blind chunks."""
    duration = _media_duration(video_path)
    if duration <= 0:
        # Assume a 10-minute video so we at least return something usable.
        duration = 600.0
    segments: List[Segment] = []
    t = 0.0
    while t < duration:
        end = min(duration, t + chunk)
        segments.append(Segment(t, end, "", []))
        t = end
    return segments
