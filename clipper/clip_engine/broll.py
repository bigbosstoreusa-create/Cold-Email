"""B-roll from a local folder.

Drop your own illustration clips into a folder and name them by keyword, e.g.
``argent.mp4``, ``money_city.mov``, ``ocean-2.webm``. When the transcript says a
matching word, that clip is briefly overlaid on top of the short (the original
audio keeps playing underneath), just like OpusClip's auto B-roll — but sourced
entirely from your own files, no account or network.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Dict, List

from .highlights import Highlight
from .transcribe import Word

VIDEO_EXTS = (".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi")
_TOKEN_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


@dataclass
class BrollInsert:
    path: str
    start: float   # seconds, relative to the clip
    end: float     # seconds, relative to the clip


def index_broll(folder: str) -> Dict[str, List[str]]:
    """Map each keyword found in filenames to the files that mention it."""
    index: Dict[str, List[str]] = {}
    if not folder or not os.path.isdir(folder):
        return index
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith(VIDEO_EXTS):
            continue
        stem = os.path.splitext(name)[0].lower()
        path = os.path.join(folder, name)
        for tok in _TOKEN_RE.findall(stem):
            if len(tok) < 3:
                continue
            index.setdefault(tok, [])
            if path not in index[tok]:
                index[tok].append(path)
    return index


def _match(word: str, index: Dict[str, List[str]]) -> List[str]:
    w = word.lower().replace("’", "'")
    if "'" in w:  # French elision: d'argent -> argent, l'ocean -> ocean
        w = w.split("'")[-1]
    stem = "".join(c for c in w if c.isalpha())
    if len(stem) < 3:
        return []
    if stem in index:
        return index[stem]
    # allow plurals / inflections: spoken word starts with the file keyword
    for key, files in index.items():
        if len(key) >= 4 and stem.startswith(key):
            return files
    return []


def plan_broll(
    highlight: Highlight,
    index: Dict[str, List[str]],
    insert_seconds: float = 2.5,
    max_inserts: int = 3,
    min_gap: float = 5.0,
) -> List[BrollInsert]:
    """Choose non-overlapping B-roll inserts matched to spoken keywords."""
    if not index:
        return []

    words: List[Word] = []
    for seg in highlight.segments:
        words.extend(seg.words)
    if not words:
        return []

    clip_start = highlight.start
    clip_len = highlight.duration
    inserts: List[BrollInsert] = []
    used_count: Dict[str, int] = {}
    last_end = -min_gap

    for w in words:
        t = w.start - clip_start
        if t < 0.5 or t < last_end + min_gap:
            continue
        files = _match(w.text, index)
        if not files:
            continue
        # Round-robin across files sharing a keyword so we vary the footage.
        key = files[0]
        pick = files[used_count.get(key, 0) % len(files)]
        used_count[key] = used_count.get(key, 0) + 1

        end = min(clip_len - 0.1, t + insert_seconds)
        if end - t < 1.0:
            continue
        inserts.append(BrollInsert(pick, t, end))
        last_end = end
        if len(inserts) >= max_inserts:
            break

    return inserts
