"""Download a video from a URL (YouTube, etc.) via yt-dlp.

For private/personal use only — respect the terms of the source platform.
"""

from __future__ import annotations

import glob
import os
from typing import Callable, Optional


def is_url(value: str) -> bool:
    return value.strip().lower().startswith(("http://", "https://"))


def download_video(
    url: str,
    dest_dir: str,
    prefix: str = "src",
    progress: Optional[Callable[[str, float], None]] = None,
) -> str:
    """Download ``url`` into ``dest_dir`` and return the local file path."""
    try:
        import yt_dlp
    except ImportError as exc:  # pragma: no cover - depends on env
        raise RuntimeError(
            "yt-dlp n'est pas installé. Ajoutez `pip install yt-dlp` pour "
            "importer depuis un lien."
        ) from exc

    os.makedirs(dest_dir, exist_ok=True)
    out_tmpl = os.path.join(dest_dir, f"{prefix}.%(ext)s")

    def hook(d: dict) -> None:
        if progress and d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            done = d.get("downloaded_bytes") or 0
            pct = (done / total) if total else 0.0
            progress("Téléchargement de la vidéo…", min(0.05 + 0.1 * pct, 0.15))

    opts = {
        "outtmpl": out_tmpl,
        "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "progress_hooks": [hook],
    }

    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    matches = sorted(glob.glob(os.path.join(dest_dir, f"{prefix}.*")))
    matches = [m for m in matches if not m.endswith((".part", ".ytdl"))]
    if not matches:
        raise RuntimeError("Le téléchargement a échoué (aucun fichier produit).")
    return matches[0]
