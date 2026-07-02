"""End-to-end orchestration: video in → styled highlight clips out."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from typing import Callable, List, Optional

from .config import ClipJobConfig, virality_label
from .highlights import Highlight, rank_highlights
from .render import render_clip
from .transcribe import transcribe

ProgressFn = Callable[[str, float], None]


@dataclass
class ClipResult:
    index: int
    filename: str
    title: str
    start: float
    end: float
    duration: float
    score: float
    virality: int
    label: str
    hashtags: List[str]
    transcript: str


def _safe_slug(text: str, fallback: str) -> str:
    keep = "".join(c if c.isalnum() or c in " -_" else "" for c in text)
    keep = "_".join(keep.split())[:40].strip("_")
    return keep or fallback


def run(
    video_path: str,
    out_dir: str,
    config: Optional[ClipJobConfig] = None,
    progress: Optional[ProgressFn] = None,
) -> List[ClipResult]:
    """Process ``video_path`` and write clips + a ``clips.json`` manifest."""
    config = config or ClipJobConfig()
    os.makedirs(out_dir, exist_ok=True)

    def report(msg: str, pct: float) -> None:
        if progress:
            progress(msg, max(0.0, min(1.0, pct)))

    if not os.path.exists(video_path):
        raise FileNotFoundError(video_path)

    report("Analyse de la vidéo…", 0.02)
    segments = transcribe(
        video_path,
        model_size=config.model_size,
        language=config.language,
        progress=progress,
    )

    report("Sélection des meilleurs moments…", 0.65)
    highlights: List[Highlight] = rank_highlights(
        segments,
        num_clips=config.num_clips,
        max_seconds=config.max_seconds,
        min_seconds=config.min_seconds,
    )

    if not highlights:
        report("Aucun extrait trouvé", 1.0)
        return []

    results: List[ClipResult] = []
    n = len(highlights)
    for i, h in enumerate(highlights, start=1):
        title = h.title()
        filename = f"clip_{i:02d}_{_safe_slug(title, f'extrait_{i}')}.mp4"
        out_path = os.path.join(out_dir, filename)
        report(f"Export {i}/{n} : {title}", 0.68 + 0.3 * (i - 1) / n)
        render_clip(video_path, h, out_path, config.render)
        viral = h.virality()
        results.append(
            ClipResult(
                index=i,
                filename=filename,
                title=title,
                start=round(h.start, 2),
                end=round(h.end, 2),
                duration=round(h.duration, 2),
                score=round(h.score, 3),
                virality=viral,
                label=virality_label(viral),
                hashtags=h.hashtags(),
                transcript=h.text,
            )
        )

    # Show best clips first, like OpusClip's ranked feed.
    results.sort(key=lambda r: r.virality, reverse=True)

    manifest = os.path.join(out_dir, "clips.json")
    with open(manifest, "w", encoding="utf-8") as f:
        json.dump([asdict(r) for r in results], f, ensure_ascii=False, indent=2)

    report(f"Terminé : {len(results)} clips générés", 1.0)
    return results
