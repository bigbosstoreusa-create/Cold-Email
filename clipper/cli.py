#!/usr/bin/env python3
"""Command-line usage:

    python cli.py my_video.mp4
    python cli.py my_video.mp4 -n 8 --aspect 9:16 --model small --out ./clips

Produces up to N highlight clips (max 60s each) in the output folder.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile

from clip_engine import ClipJobConfig, RenderOptions, download_video, is_url, run


def main() -> int:
    p = argparse.ArgumentParser(description="Découpe une longue vidéo en clips courts.")
    p.add_argument("video", help="Chemin de la vidéo OU lien (YouTube…)")
    p.add_argument("-o", "--out", default="./clips", help="Dossier de sortie")
    p.add_argument("-n", "--num", type=int, default=6, help="Nombre de clips")
    p.add_argument("--max", type=float, default=60.0, help="Durée max d'un clip (s)")
    p.add_argument("--min", type=float, default=15.0, help="Durée min d'un clip (s)")
    p.add_argument("--model", default="base",
                   help="Modèle Whisper: tiny/base/small/medium")
    p.add_argument("--lang", default=None, help="Langue (fr, en…) sinon auto")
    p.add_argument("--aspect", default="9:16", choices=["9:16", "1:1", "original"])
    p.add_argument("--fill", default="track", choices=["track", "blur", "crop"],
                   help="track = suit le visage (défaut)")
    p.add_argument("--captions", default="karaoke",
                   choices=["karaoke", "plain", "none"])
    p.add_argument("--no-emojis", action="store_true",
                   help="Désactive les emojis dans les sous-titres")
    p.add_argument("--broll", default="", metavar="DOSSIER",
                   help="Dossier de clips B-roll (nommés par mot-clé)")
    args = p.parse_args()

    config = ClipJobConfig(
        num_clips=args.num,
        max_seconds=args.max,
        min_seconds=args.min,
        model_size=args.model,
        language=args.lang,
        render=RenderOptions(
            aspect=args.aspect,
            fill=args.fill,
            captions=args.captions != "none",
            caption_style="plain" if args.captions == "plain" else "karaoke",
            emojis=not args.no_emojis,
            broll=bool(args.broll),
            broll_dir=args.broll,
        ),
    )

    source = args.video
    if is_url(source):
        print("Téléchargement du lien…")
        source = download_video(source, tempfile.mkdtemp(prefix="clipper_"))

    def progress(msg: str, pct: float) -> None:
        bar = "█" * int(pct * 30)
        print(f"\r[{bar:<30}] {pct*100:5.1f}%  {msg[:50]:<50}", end="", flush=True)

    try:
        results = run(source, args.out, config, progress)
    except Exception as exc:  # noqa: BLE001
        print(f"\nErreur: {exc}", file=sys.stderr)
        return 1

    print()
    if not results:
        print("Aucun clip généré.")
        return 0
    print(f"\n{len(results)} clips dans {os.path.abspath(args.out)} :")
    for r in results:
        tags = " ".join(r.hashtags)
        print(f"  [{r.virality:3d}/100 {r.label}] {r.title}  "
              f"({r.duration:.0f}s) → {r.filename}")
        if tags:
            print(f"        {tags}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
