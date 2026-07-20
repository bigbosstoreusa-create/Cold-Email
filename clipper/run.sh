#!/usr/bin/env bash
# One-shot launcher for the Home Clipper web app.
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "→ Création de l'environnement virtuel…"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "→ Installation des dépendances…"
pip install -q --upgrade pip
pip install -q -r requirements.txt

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "⚠  ffmpeg introuvable. Installe-le : brew install ffmpeg / apt install ffmpeg"
fi

echo "→ Ouvre http://127.0.0.1:8000"
exec uvicorn app:app --host 127.0.0.1 --port 8000
