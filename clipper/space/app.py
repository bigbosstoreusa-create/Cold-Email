#!/usr/bin/env python3
"""Home Clipper — application web autonome (généré par space/build_app.py).

Un seul fichier : moteur de découpage + interface Gradio. Déposez-le dans un
Hugging Face Space (avec requirements.txt et packages.txt).
"""

from __future__ import annotations



# ---- clip_engine/config.py ----------------------------------------

"""Central configuration & tuning knobs for the clip engine.

Everything a home user might reasonably want to tweak lives here so the
rest of the code stays readable.
"""


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


# Keyword → emoji, injected into captions when the word is spoken (FR/EN).
# Matching is on the word stem (startswith), so "argent"/"argents" both hit.
EMOJI_MAP: dict[str, str] = {
    "argent": "💰", "euro": "💰", "dollar": "💰", "money": "💰", "cash": "💰",
    "riche": "🤑", "million": "💸", "gratuit": "🆓", "free": "🆓",
    "feu": "🔥", "fire": "🔥", "chaud": "🔥", "incroyable": "🤯", "fou": "🤯",
    "dingue": "🤯", "crazy": "🤯", "mind": "🤯", "wow": "😮", "choc": "😱",
    "peur": "😱", "attention": "⚠️", "danger": "⚠️", "warning": "⚠️",
    "erreur": "❌", "faux": "❌", "mistake": "❌", "wrong": "❌", "stop": "🛑",
    "secret": "🤫", "astuce": "💡", "idée": "💡", "tip": "💡", "idea": "💡",
    "solution": "✅", "parfait": "✅", "oui": "✅", "yes": "✅", "gagner": "🏆",
    "meilleur": "🏆", "best": "🏆", "win": "🏆", "victoire": "🏆",
    "temps": "⏰", "time": "⏰", "vite": "⚡", "rapide": "⚡", "fast": "⚡",
    "amour": "❤️", "love": "❤️", "coeur": "❤️", "cœur": "❤️",
    "musique": "🎵", "music": "🎵", "travail": "💼", "business": "💼",
    "cerveau": "🧠", "intelligent": "🧠", "smart": "🧠", "question": "🤔",
    "pourquoi": "🤔", "why": "🤔", "grand": "📈", "croissance": "📈",
    "monde": "🌍", "world": "🌍", "email": "📧", "mail": "📧",
}


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
    emojis: bool = True           # sprinkle keyword emojis into captions
    broll: bool = False           # overlay B-roll from a local folder
    broll_dir: str = ""           # folder of keyword-named clips
    broll_seconds: float = 2.5    # length of each B-roll insert
    broll_max: int = 3            # max inserts per clip
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


# ---- clip_engine/transcribe.py ----------------------------------------

"""Speech-to-text with word-level timestamps.

Uses faster-whisper when available (fast, local, offline). If it is not
installed we fall back to a naive time-based chunking so the rest of the
pipeline still produces clips (just without smart highlight scoring).
"""


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


# ---- clip_engine/highlights.py ----------------------------------------

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


import re
from dataclasses import dataclass
from typing import List


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


# ---- clip_engine/reframe.py ----------------------------------------

"""Face-aware auto-reframe (OpusClip-style "follow the speaker").

We sample frames across the clip with OpenCV, find the main face in each,
smooth the horizontal path, and turn it into a time-varying ffmpeg ``crop``
expression. ffmpeg then does the heavy lifting in a single pass.

If OpenCV is unavailable or no face is ever found, callers fall back to the
static blur / center-crop reframe.
"""


from typing import List, Optional, Tuple

# (relative_time_seconds, face_center_x_fraction[0..1])
Track = List[Tuple[float, float]]


def _detector():
    try:
        import cv2  # noqa: F401
    except ImportError:
        return None, None
    import cv2

    path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(path)
    if cascade.empty():
        return None, None
    return cv2, cascade


def compute_face_track(
    video_path: str,
    start: float,
    end: float,
    sample_fps: float = 2.0,
) -> Optional[Tuple[Track, int, int]]:
    """Return (track, src_w, src_h) or None if tracking is not possible."""
    cv2, cascade = _detector()
    if cv2 is None:
        return None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 0
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 0
    if src_w == 0 or src_h == 0:
        cap.release()
        return None

    step = 1.0 / max(sample_fps, 0.5)
    raw: Track = []
    last_cx: Optional[float] = None
    t = 0.0
    duration = max(0.0, end - start)
    found_any = False

    while t <= duration:
        cap.set(cv2.CAP_PROP_POS_MSEC, (start + t) * 1000.0)
        ok, frame = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, 1.15, 5, minSize=(60, 60))
        if len(faces):
            # Track the largest face (usually the speaker).
            x, _y, w, _h = max(faces, key=lambda f: f[2] * f[3])
            cx = (x + w / 2.0) / src_w
            last_cx = cx
            found_any = True
        cx = last_cx if last_cx is not None else 0.5
        raw.append((t, cx))
        t += step

    cap.release()
    if not raw or not found_any:
        return None

    return _smooth(raw), src_w, src_h


def _smooth(track: Track, window: int = 5) -> Track:
    """Moving-average smoothing so the crop glides instead of jumping."""
    xs = [cx for _, cx in track]
    n = len(xs)
    out: Track = []
    half = window // 2
    for i, (t, _) in enumerate(track):
        lo, hi = max(0, i - half), min(n, i + half + 1)
        avg = sum(xs[lo:hi]) / (hi - lo)
        out.append((t, avg))
    return out


def build_track_crop(
    track: Track,
    src_w: int,
    src_h: int,
    target_w: int,
    target_h: int,
    label_in: str,
    label_out: str,
    min_delta: float = 0.01,
) -> str:
    """Build a crop(+scale) filter whose x follows the smoothed face path."""
    aspect = target_w / target_h
    crop_w = min(src_w, int(round(src_h * aspect)))
    crop_h = min(src_h, int(round(crop_w / aspect)))
    crop_w -= crop_w % 2
    crop_h -= crop_h % 2

    max_x = max(0, src_w - crop_w)

    # Convert normalised centres to clamped top-left x, dropping tiny changes
    # to keep the expression compact.
    points: List[Tuple[float, int]] = []
    last_x: Optional[int] = None
    for t, cx in track:
        x = int(round(cx * src_w - crop_w / 2.0))
        x = max(0, min(max_x, x))
        if last_x is None or abs(x - last_x) >= min_delta * src_w or not points:
            points.append((t, x))
            last_x = x
    if not points:
        points = [(0.0, max_x // 2)]

    # Nested if(lt(t, ...)) piecewise-constant expression over relative time.
    expr = str(points[-1][1])
    for t, x in reversed(points[:-1]):
        expr = f"if(lt(t,{t:.2f}),{x},{expr})"

    return (
        f"[{label_in}]crop={crop_w}:{crop_h}:x='{expr}':y=0,"
        f"scale={target_w}:{target_h},setsar=1[{label_out}]"
    )


# ---- clip_engine/broll.py ----------------------------------------

"""B-roll from a local folder.

Drop your own illustration clips into a folder and name them by keyword, e.g.
``argent.mp4``, ``money_city.mov``, ``ocean-2.webm``. When the transcript says a
matching word, that clip is briefly overlaid on top of the short (the original
audio keeps playing underneath), just like OpusClip's auto B-roll — but sourced
entirely from your own files, no account or network.
"""


import os
import re
from dataclasses import dataclass
from typing import Dict, List


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


# ---- clip_engine/render.py ----------------------------------------

"""Cut and style clips with ffmpeg (auto-reframe + animated captions)."""


import os
import shutil
import subprocess
import tempfile
from typing import List, Optional, Tuple



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


# ---- clip_engine/fetch.py ----------------------------------------

"""Download a video from a URL (YouTube, etc.) via yt-dlp.

For private/personal use only — respect the terms of the source platform.
"""


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


# ---- clip_engine/pipeline.py ----------------------------------------

"""End-to-end orchestration: video in → styled highlight clips out."""


import json
import os
from dataclasses import asdict, dataclass
from typing import Callable, List, Optional


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



# ==========================================================================
#  Interface web (Gradio) — tout est local au Space, rien ne fuit ailleurs.
# ==========================================================================

import tempfile

import gradio as gr


def _process(video, url, num_clips, aspect, fill, caption_style, emojis,
             model, language, progress=gr.Progress()):
    src = video
    if (not src) and url and is_url(url):
        progress(0.02, desc="Téléchargement du lien…")
        src = download_video(url, tempfile.mkdtemp())
    if not src:
        raise gr.Error("Ajoute une vidéo ou colle un lien YouTube.")

    out_dir = tempfile.mkdtemp()
    config = ClipJobConfig(
        num_clips=int(num_clips),
        model_size=model,
        language=language or None,
        render=RenderOptions(
            aspect=aspect,
            fill=fill,
            captions=(caption_style != "Aucun"),
            caption_style=("plain" if caption_style == "Simples" else "karaoke"),
            emojis=bool(emojis),
        ),
    )

    def prog(msg, pct):
        progress(min(max(pct, 0.0), 1.0), desc=msg)

    results = run(src, out_dir, config, prog)
    if not results:
        return "Aucun extrait trouvé.", None, []

    rows = ["| Score | Titre | Durée | Hashtags |", "|---|---|---|---|"]
    files = []
    for r in results:
        rows.append(
            f"| {r.label} **{r.virality}/100** | {r.title} | "
            f"{r.duration:.0f}s | {' '.join(r.hashtags)} |"
        )
        files.append(os.path.join(out_dir, r.filename))
    top = files[0] if files else None
    return "\n".join(rows), top, files


with gr.Blocks(title="Home Clipper", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        "# 🎬 Home Clipper\n"
        "Transforme une longue vidéo en **shorts viraux** (≤ 1 min) : "
        "meilleurs moments, score de viralité, recadrage qui suit le visage, "
        "sous-titres karaoké & emojis."
    )
    with gr.Row():
        with gr.Column():
            video = gr.Video(label="📁 Ta vidéo", sources=["upload"])
            url = gr.Textbox(label="🔗 …ou lien YouTube",
                             placeholder="https://www.youtube.com/watch?v=…")
            with gr.Row():
                num_clips = gr.Slider(1, 15, value=6, step=1,
                                      label="Nombre de clips")
                model = gr.Dropdown(["tiny", "base", "small"], value="tiny",
                                    label="Précision (tiny = rapide)")
            with gr.Row():
                aspect = gr.Dropdown(["9:16", "1:1", "original"], value="9:16",
                                     label="Format")
                fill = gr.Dropdown(["track", "blur", "crop"], value="track",
                                   label="Recadrage (track = suit le visage)")
            with gr.Row():
                caption_style = gr.Dropdown(["Karaoké", "Simples", "Aucun"],
                                            value="Karaoké", label="Sous-titres")
                language = gr.Dropdown(["", "fr", "en"], value="",
                                       label="Langue (auto si vide)")
            emojis = gr.Checkbox(value=True, label="Emojis 🔥")
            btn = gr.Button("✨ Générer les clips", variant="primary")
        with gr.Column():
            out_md = gr.Markdown(label="Résultats")
            out_top = gr.Video(label="🏆 Meilleur clip")
            out_files = gr.Files(label="⬇ Tous les clips")

    btn.click(
        _process,
        [video, url, num_clips, aspect, fill, caption_style, emojis, model,
         language],
        [out_md, out_top, out_files],
    )


if __name__ == "__main__":
    # Optionnel : protège l'accès en définissant APP_USER / APP_PASS dans les
    # "Secrets" du Space (sinon le lien est public).
    _user = os.environ.get("APP_USER")
    _pass = os.environ.get("APP_PASS")
    _auth = (_user, _pass) if _user and _pass else None
    demo.launch(auth=_auth)
