#!/usr/bin/env python3
"""Assemble a single self-contained `app.py` for Hugging Face Spaces.

It concatenates the clip_engine modules (stripping intra-package imports) and
appends the Gradio UI (_ui_tail.py). Re-run this whenever the engine changes:

    python space/build_app.py
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(os.path.dirname(HERE), "clip_engine")

# Dependency order.
MODULES = [
    "config.py", "transcribe.py", "highlights.py", "reframe.py",
    "broll.py", "render.py", "fetch.py", "pipeline.py",
]

HEADER = (
    "#!/usr/bin/env python3\n"
    '"""Home Clipper — application web autonome (généré par space/build_app.py).\n\n'
    "Un seul fichier : moteur de découpage + interface Gradio. Déposez-le dans un\n"
    "Hugging Face Space (avec requirements.txt et packages.txt).\n"
    '"""\n\n'
    "from __future__ import annotations\n\n"
)


def strip_module(text: str) -> str:
    lines = text.splitlines()
    out = []
    skip_until_paren = False
    for line in lines:
        if skip_until_paren:
            if ")" in line:
                skip_until_paren = False
            continue
        # Drop the per-file future import (we add one at the top).
        if line.strip() == "from __future__ import annotations":
            continue
        # Drop intra-package relative imports.
        if re.match(r"\s*from \.", line):
            if "(" in line and ")" not in line:
                skip_until_paren = True
            continue
        # Drop module docstrings' first triple-quote block? Keep them: harmless.
        out.append(line)
    return "\n".join(out).strip() + "\n"


def main() -> None:
    parts = [HEADER]
    for mod in MODULES:
        with open(os.path.join(ENGINE, mod), encoding="utf-8") as f:
            body = strip_module(f.read())
        parts.append(f"\n# ---- clip_engine/{mod} " + "-" * 40 + "\n\n" + body)

    with open(os.path.join(HERE, "_ui_tail.py"), encoding="utf-8") as f:
        parts.append("\n" + f.read())

    with open(os.path.join(HERE, "app.py"), "w", encoding="utf-8") as f:
        f.write("\n".join(parts))
    print("Écrit:", os.path.join(HERE, "app.py"))


if __name__ == "__main__":
    main()
