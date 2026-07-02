"""Face-aware auto-reframe (OpusClip-style "follow the speaker").

We sample frames across the clip with OpenCV, find the main face in each,
smooth the horizontal path, and turn it into a time-varying ffmpeg ``crop``
expression. ffmpeg then does the heavy lifting in a single pass.

If OpenCV is unavailable or no face is ever found, callers fall back to the
static blur / center-crop reframe.
"""

from __future__ import annotations

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
