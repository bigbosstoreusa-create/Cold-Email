#!/usr/bin/env python3
"""Command-line usage:

    python cli.py my_video.mp4
    python cli.py my_video.mp4 -n 8 --aspect 9:16 --model small --out ./clips

Produces up to N highlight clips (max 60s each) in the output folder.
"""

from __future__ import annotations

import argparse
import sys

from clip_engine import ClipJobConfig, RenderOptions, run


def main() -> int:
    p = argparse.ArgumentParser(description="Découpe une longue vidéo en clips courts.")
    p.add_argument("video", help="Chemin de la vidéo source")
    p.add_argument("-o", "--out", default="./clips", help="Dossier de sortie")
    p.add_argument("-n", "--num", type=int, default=6, help="Nombre de clips")
    p.add_argument("--max", type=float, default=60.0, help="Durée max d'un clip (s)")
    p.add_argument("--min", type=float, default=15.0, help="Durée min d'un clip (s)")
    p.add_argument("--model", default="base",
                   help="Modèle Whisper: tiny/base/small/medium")
    p.add_argument("--lang", default=None, help="Langue (fr, en…) sinon auto")
    p.add_argument("--aspect", default="9:16", choices=["9:16", "1:1", "original"])
    p.add_argument("--fill", default="blur", choices=["blur", "crop"])
    p.add_argument("--no-captions", action="store_true", help="Sans sous-titres")
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
            captions=not args.no_captions,
        ),
    )

    def progress(msg: str, pct: float) -> None:
        bar = "█" * int(pct * 30)
        print(f"\r[{bar:<30}] {pct*100:5.1f}%  {msg[:50]:<50}", end="", flush=True)

    try:
        results = run(args.video, args.out, config, progress)
    except Exception as exc:  # noqa: BLE001
        print(f"\nErreur: {exc}", file=sys.stderr)
        return 1

    print()
    if not results:
        print("Aucun clip généré.")
        return 0
    print(f"\n{len(results)} clips dans {args.out} :")
    for r in results:
        print(f"  {r.index:02d}. {r.title}  "
              f"({r.duration:.0f}s, score {r.score:.2f}) → {r.filename}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
