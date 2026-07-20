"""Cut and style clips with ffmpeg (auto-reframe + animated captions)."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from typing import List, Optional, Tuple

from .config import RenderOptions
from .highlights import Highlight
from .reframe import build_track_crop, compute_face_track
from .transcribe import Word


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


_TARGETS = {
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
}


def _collect_words(h: Highlight) -> List[Word]:
    words: List[Word] = []
    for seg in h.segments:
        words.extend(seg.words)
    return words


def _escape_for_filter(path: str) -> str:
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


# --- Plain SRT captions ---------------------------------------------------

def _fmt_srt(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = min(999, int(round((seconds - int(seconds)) * 1000)))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(words: List[Word], clip_start: float, per_line: int) -> str:
    lines: List[str] = []
    idx = 1
    for i in range(0, len(words), per_line):
        chunk = words[i : i + per_line]
        if not chunk:
            continue
        start = max(0.0, chunk[0].start - clip_start)
        end = max(start + 0.3, chunk[-1].end - clip_start)
        text = " ".join(w.text for w in chunk).strip()
        if not text:
            continue
        lines += [str(idx), f"{_fmt_srt(start)} --> {_fmt_srt(end)}", text, ""]
        idx += 1
    return "\n".join(lines)


# --- Karaoke (word-by-word) ASS captions ----------------------------------

def _fmt_ass(seconds: float) -> str:
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = min(99, int(round((seconds - int(seconds)) * 100)))
    return f"{h:d}:{m:02d}:{s:02d}.{cs:02d}"


def _word_stem(word: str) -> str:
    """Lowercase alpha stem, dropping French elisions (d'argent → argent)."""
    w = word.lower().replace("’", "'")
    if "'" in w:
        w = w.split("'")[-1]
    return "".join(c for c in w if c.isalpha())


def _emoji_for(word: str) -> str:
    """Return an emoji for a spoken word (stem match), or '' if none."""
    from .config import EMOJI_MAP

    stem = _word_stem(word)
    if len(stem) < 3:
        return ""
    # Match only when the spoken word *starts with* a keyword (handles plurals
    # like "secrets"), never the reverse — so "pour" won't hit "pourquoi".
    for key, emo in EMOJI_MAP.items():
        if stem.startswith(key):
            return emo
    return ""


def build_ass(
    words: List[Word],
    clip_start: float,
    per_line: int,
    target_w: int,
    target_h: int,
    font_size: int,
    emojis: bool = True,
) -> str:
    """ASS subtitles with a karaoke sweep: each word lights up as it's said."""
    fontsize = max(24, round(target_h * font_size / 400))
    margin_v = round(target_h * 0.12)
    margin_h = round(target_w * 0.06)

    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {target_w}\nPlayResY: {target_h}\n"
        "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        # Primary (sung) = bright yellow, Secondary (not yet) = white.
        f"Style: Pop,Arial,{fontsize},&H0000FFFF,&H00FFFFFF,&H00000000,"
        f"&H64000000,-1,0,0,0,100,100,0,0,1,4,2,2,{margin_h},{margin_h},"
        f"{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, "
        "MarginV, Effect, Text\n"
    )

    events: List[str] = []
    for i in range(0, len(words), per_line):
        chunk = words[i : i + per_line]
        chunk = [w for w in chunk if w.text.strip()]
        if not chunk:
            continue
        start = max(0.0, chunk[0].start - clip_start)
        end = max(start + 0.3, chunk[-1].end - clip_start)

        # Build the karaoke body: each word gets a \k of its spoken length.
        body_parts: List[str] = []
        prev_end = chunk[0].start
        for w in chunk:
            gap = max(0.0, w.start - prev_end)
            if gap > 0.02:
                body_parts.append(f"{{\\k{int(round(gap * 100))}}}")
            dur = max(1, int(round((w.end - w.start) * 100)))
            text = w.text.strip().replace("{", "(").replace("}", ")")
            emo = _emoji_for(w.text) if emojis else ""
            # The emoji shares the word's \k so it pops in as the word is said.
            token = f"{text} {emo}" if emo else text
            body_parts.append(f"{{\\k{dur}}}{token} ")
            prev_end = w.end
        body = "".join(body_parts).strip()
        events.append(
            f"Dialogue: 0,{_fmt_ass(start)},{_fmt_ass(end)},Pop,,0,0,0,,{body}"
        )

    return header + "\n".join(events) + "\n"


# --- Reframe chains -------------------------------------------------------

def _static_reframe(opts: RenderOptions, lin: str, lout: str) -> str:
    if opts.aspect == "original" or opts.aspect not in _TARGETS:
        return f"[{lin}]null[{lout}]"
    w, h = _TARGETS[opts.aspect]
    if opts.fill == "crop":
        return (
            f"[{lin}]scale={w}:{h}:force_original_aspect_ratio=increase,"
            f"crop={w}:{h},setsar=1[{lout}]"
        )
    return (
        f"[{lin}]split=2[bg][fg];"
        f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"boxblur=luma_radius=40:luma_power=2[bgb];"
        f"[fg]scale={w}:{h}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1[{lout}]"
    )


def _video_chain(source: str, h: Highlight, opts: RenderOptions,
                 lin: str, lout: str) -> Tuple[str, bool]:
    """Return (filter_chain, tracked?) producing ``lout`` from ``lin``."""
    if opts.fill == "track" and opts.aspect in _TARGETS:
        tw, th = _TARGETS[opts.aspect]
        track = compute_face_track(source, h.start, h.end)
        if track is not None:
            pts, sw, sh = track
            return build_track_crop(pts, sw, sh, tw, th, lin, lout), True
        # No face / no OpenCV → graceful fallback to blurred pad.
        fallback = RenderOptions(**{**opts.__dict__, "fill": "blur"})
        return _static_reframe(fallback, lin, lout), False
    return _static_reframe(opts, lin, lout), False


def _broll_chain(inserts, target_w, target_h, lin, lout):
    """Build overlay chain + extra ffmpeg inputs for local B-roll inserts."""
    parts: List[str] = []
    extra_inputs: List[str] = []
    cur = lin
    for i, ins in enumerate(inserts):
        idx = i + 1  # main video is input 0; B-roll inputs follow
        extra_inputs += ["-stream_loop", "-1", "-i", ins.path]
        blabel = f"b{i}"
        nxt = lout if i == len(inserts) - 1 else f"{lout}{i}"
        parts.append(
            f"[{idx}:v]scale={target_w}:{target_h}:"
            f"force_original_aspect_ratio=increase,crop={target_w}:{target_h},"
            f"setsar=1,setpts=PTS-STARTPTS+{ins.start:.3f}/TB[{blabel}]"
        )
        parts.append(
            f"[{cur}][{blabel}]overlay=0:0:"
            f"enable='between(t,{ins.start:.3f},{ins.end:.3f})'[{nxt}]"
        )
        cur = nxt
    return ";".join(parts), extra_inputs


# --- Main entry -----------------------------------------------------------

def render_clip(
    source_video: str,
    highlight: Highlight,
    out_path: str,
    opts: RenderOptions,
) -> str:
    if not ffmpeg_available():
        raise RuntimeError(
            "ffmpeg introuvable. Installez-le (ex: `brew install ffmpeg` "
            "ou `sudo apt install ffmpeg`)."
        )

    duration = highlight.duration
    tmp_sub: Optional[str] = None

    chain, _tracked = _video_chain(source_video, highlight, opts, "0:v", "v0")
    last = "v0"

    # B-roll overlays go under the captions but over the reframed video.
    extra_inputs: List[str] = []
    if opts.broll and opts.broll_dir and opts.aspect in _TARGETS:
        from .broll import index_broll, plan_broll

        idx = index_broll(opts.broll_dir)
        plan = plan_broll(highlight, idx, opts.broll_seconds, opts.broll_max)
        if plan:
            tw, th = _TARGETS[opts.aspect]
            bchain, extra_inputs = _broll_chain(plan, tw, th, last, "vb")
            chain += ";" + bchain
            last = "vb"

    words = _collect_words(highlight) if opts.captions else []
    if opts.captions and words:
        tw, th = _TARGETS.get(opts.aspect, (1080, 1920))
        if opts.caption_style == "karaoke":
            fd, tmp_sub = tempfile.mkstemp(suffix=".ass")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(build_ass(words, highlight.start,
                                  opts.caption_words_per_line, tw, th,
                                  opts.font_size, opts.emojis))
            cap = f"ass='{_escape_for_filter(tmp_sub)}'"
        else:
            fd, tmp_sub = tempfile.mkstemp(suffix=".srt")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(build_srt(words, highlight.start,
                                  opts.caption_words_per_line))
            style = (
                f"FontSize={opts.font_size},PrimaryColour=&H00FFFFFF,"
                "OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,"
                "Alignment=2,MarginV=90,Bold=1"
            )
            cap = f"subtitles='{_escape_for_filter(tmp_sub)}':force_style='{style}'"
        chain += f";[{last}]{cap}[vout]"
        last = "vout"

    cmd = (
        ["ffmpeg", "-y", "-ss", f"{highlight.start:.3f}", "-i", source_video]
        + extra_inputs
        + [
            "-t", f"{duration:.3f}",
            "-filter_complex", chain,
            "-map", f"[{last}]",
            "-map", "0:a?",
            "-c:v", "libx264", "-preset", opts.preset, "-crf", str(opts.crf),
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            out_path,
        ]
    )

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as exc:  # pragma: no cover - runtime
        raise RuntimeError(
            f"Échec ffmpeg sur {os.path.basename(out_path)}:\n{exc.stderr[-1500:]}"
        ) from exc
    finally:
        if tmp_sub and os.path.exists(tmp_sub):
            os.remove(tmp_sub)

    return out_path
