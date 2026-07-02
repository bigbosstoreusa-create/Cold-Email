"""Cut and style clips with ffmpeg (reframe + burned-in captions)."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from typing import List

from .config import RenderOptions
from .highlights import Highlight
from .transcribe import Word


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


# --- Subtitles ------------------------------------------------------------

def _fmt_ts(seconds: float) -> str:
    if seconds < 0:
        seconds = 0.0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms == 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(words: List[Word], clip_start: float, words_per_line: int) -> str:
    """Group word timestamps (rebased to the clip) into short caption cues."""
    lines: List[str] = []
    idx = 1
    for i in range(0, len(words), words_per_line):
        chunk = words[i : i + words_per_line]
        if not chunk:
            continue
        start = max(0.0, chunk[0].start - clip_start)
        end = max(start + 0.3, chunk[-1].end - clip_start)
        text = " ".join(w.text for w in chunk).strip()
        if not text:
            continue
        lines.append(str(idx))
        lines.append(f"{_fmt_ts(start)} --> {_fmt_ts(end)}")
        lines.append(text)
        lines.append("")
        idx += 1
    return "\n".join(lines)


def _collect_words(h: Highlight) -> List[Word]:
    words: List[Word] = []
    for seg in h.segments:
        words.extend(seg.words)
    return words


# --- Filtergraph ----------------------------------------------------------

_TARGETS = {
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
}


def _escape_for_filter(path: str) -> str:
    # ffmpeg filter arg escaping: backslash, colon and single quotes.
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _reframe_chain(opts: RenderOptions, label_in: str, label_out: str) -> str:
    if opts.aspect == "original" or opts.aspect not in _TARGETS:
        return f"[{label_in}]null[{label_out}]"

    w, h = _TARGETS[opts.aspect]
    if opts.fill == "crop":
        return (
            f"[{label_in}]scale={w}:{h}:force_original_aspect_ratio=increase,"
            f"crop={w}:{h},setsar=1[{label_out}]"
        )
    # Blurred padded background (keeps the whole subject in frame).
    return (
        f"[{label_in}]split=2[bg][fg];"
        f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"boxblur=luma_radius=40:luma_power=2[bgb];"
        f"[fg]scale={w}:{h}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1[{label_out}]"
    )


def _caption_filter(srt_path: str, opts: RenderOptions) -> str:
    style = (
        f"FontSize={opts.font_size},PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,"
        "Alignment=2,MarginV=90,Bold=1"
    )
    return f"subtitles='{_escape_for_filter(srt_path)}':force_style='{style}'"


def render_clip(
    source_video: str,
    highlight: Highlight,
    out_path: str,
    opts: RenderOptions,
) -> str:
    """Render a single highlight to ``out_path``; returns the path."""
    if not ffmpeg_available():
        raise RuntimeError(
            "ffmpeg introuvable. Installez-le (ex: `brew install ffmpeg` "
            "ou `sudo apt install ffmpeg`)."
        )

    duration = highlight.duration
    tmp_srt = None

    # Build the video filter chain.
    chain = _reframe_chain(opts, "0:v", "v0")
    last_label = "v0"

    words = _collect_words(highlight) if opts.captions else []
    if opts.captions and words:
        fd, tmp_srt = tempfile.mkstemp(suffix=".srt")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(build_srt(words, highlight.start, opts.caption_words_per_line))
        chain += f";[{last_label}]{_caption_filter(tmp_srt, opts)}[vout]"
        last_label = "vout"

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{highlight.start:.3f}",
        "-i", source_video,
        "-t", f"{duration:.3f}",
        "-filter_complex", chain,
        "-map", f"[{last_label}]",
        "-map", "0:a?",
        "-c:v", "libx264", "-preset", opts.preset, "-crf", str(opts.crf),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        out_path,
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as exc:  # pragma: no cover - runtime
        raise RuntimeError(
            f"Échec ffmpeg sur {os.path.basename(out_path)}:\n{exc.stderr[-1500:]}"
        ) from exc
    finally:
        if tmp_srt and os.path.exists(tmp_srt):
            os.remove(tmp_srt)

    return out_path
