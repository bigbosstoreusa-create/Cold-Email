#!/usr/bin/env python3
"""Local web app (FastAPI) for the highlight clipper.

Run:  uvicorn app:app --reload   (then open http://127.0.0.1:8000)

Everything stays on your machine — no upload leaves the network.
"""

from __future__ import annotations

import os
import shutil
import threading
import uuid
from dataclasses import asdict
from typing import Dict

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from clip_engine import ClipJobConfig, RenderOptions, download_video, is_url, run

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
OUTPUT_DIR = os.path.join(DATA_DIR, "output")
BROLL_DIR = os.path.join(DATA_DIR, "broll")  # drop keyword-named clips here
STATIC_DIR = os.path.join(BASE_DIR, "static")
for d in (UPLOAD_DIR, OUTPUT_DIR, BROLL_DIR):
    os.makedirs(d, exist_ok=True)

app = FastAPI(title="Home Clipper")

# In-memory job registry (fine for single-user home use).
_jobs: Dict[str, dict] = {}
_lock = threading.Lock()


def _set(job_id: str, **fields) -> None:
    with _lock:
        _jobs.setdefault(job_id, {}).update(fields)


def _process(
    job_id: str,
    config: ClipJobConfig,
    video_path: Optional[str] = None,
    url: Optional[str] = None,
) -> None:
    out_dir = os.path.join(OUTPUT_DIR, job_id)

    def progress(msg: str, pct: float) -> None:
        _set(job_id, status="running", message=msg, progress=round(pct, 3))

    try:
        if url:
            progress("Téléchargement de la vidéo…", 0.03)
            video_path = download_video(url, UPLOAD_DIR, prefix=job_id,
                                        progress=progress)
        results = run(video_path, out_dir, config, progress)
        _set(
            job_id,
            status="done",
            progress=1.0,
            message=f"{len(results)} clips générés",
            clips=[asdict(r) for r in results],
        )
    except Exception as exc:  # noqa: BLE001
        _set(job_id, status="error", message=str(exc))
    finally:
        # Keep the source only if something failed (helps debugging).
        with _lock:
            failed = _jobs.get(job_id, {}).get("status") == "error"
        if not failed and video_path and os.path.exists(video_path):
            try:
                os.remove(video_path)
            except OSError:
                pass


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    with open(os.path.join(STATIC_DIR, "index.html"), encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/jobs")
async def create_job(
    file: Optional[UploadFile] = File(None),
    url: str = Form(""),
    num_clips: int = Form(6),
    max_seconds: float = Form(60.0),
    min_seconds: float = Form(15.0),
    model_size: str = Form("base"),
    language: str = Form(""),
    aspect: str = Form("9:16"),
    fill: str = Form("track"),
    captions: bool = Form(True),
    caption_style: str = Form("karaoke"),
    emojis: bool = Form(True),
    broll: bool = Form(False),
) -> dict:
    job_id = uuid.uuid4().hex[:12]
    url = url.strip()

    video_path: Optional[str] = None
    display_name = ""
    if file is not None and file.filename:
        display_name = os.path.basename(file.filename)
        video_path = os.path.join(UPLOAD_DIR, f"{job_id}_{display_name}")
        with open(video_path, "wb") as out:
            shutil.copyfileobj(file.file, out)
    elif is_url(url):
        display_name = url
    else:
        raise HTTPException(400, "Fournissez un fichier vidéo ou un lien.")

    config = ClipJobConfig(
        num_clips=max(1, min(num_clips, 30)),
        max_seconds=min(max_seconds, 60.0),  # enforce the 1-minute ceiling
        min_seconds=max(3.0, min_seconds),
        model_size=model_size,
        language=language or None,
        render=RenderOptions(
            aspect=aspect, fill=fill, captions=captions,
            caption_style=caption_style, emojis=emojis,
            broll=broll, broll_dir=BROLL_DIR,
        ),
    )

    _set(job_id, status="queued", progress=0.0, message="En file d'attente",
         filename=display_name, clips=[])
    threading.Thread(
        target=_process, kwargs=dict(job_id=job_id, config=config,
                                     video_path=video_path,
                                     url=url if not video_path else None),
        daemon=True,
    ).start()
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str) -> dict:
    with _lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job inconnu")
    return {"job_id": job_id, **job}


@app.get("/api/clips/{job_id}/{filename}")
def get_clip(job_id: str, filename: str):
    safe = os.path.basename(filename)
    path = os.path.join(OUTPUT_DIR, job_id, safe)
    if not os.path.isfile(path):
        raise HTTPException(404, "Clip introuvable")
    return FileResponse(path, media_type="video/mp4", filename=safe)


if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
