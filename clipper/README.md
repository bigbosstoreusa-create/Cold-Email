# 🎬 Home Clipper

Un mini-OpusClip **100 % local**, pour un usage privé à la maison. Tu lui donnes
une longue vidéo, il en sort automatiquement plusieurs **shorts de 1 minute
maximum**, découpés sur les **meilleurs passages**, recadrés en vertical 9:16
et sous-titrés.

Rien ne quitte ta machine : pas de cloud, pas de compte, pas d'abonnement.

---

## Comment ça marche

1. **Transcription** de la vidéo avec Whisper en local (horodatage mot à mot).
2. **Sélection des meilleurs moments** : le texte est regroupé en fenêtres de
   ≤ 60 s, puis noté selon des critères transparents — accroches (« secret »,
   « erreur », « comment »…), questions, chiffres, énergie de parole, longueur
   idéale. Les meilleures fenêtres, sans chevauchement, sont retenues.
3. **Montage ffmpeg** : découpe, recadrage vertical (fond flou ou crop centré)
   et sous-titres incrustés facon Shorts/TikTok.

Tout est expliqué et réglable dans `clip_engine/config.py`.

---

## Installation

Prérequis : **Python 3.9+** et **ffmpeg**.

```bash
# ffmpeg
brew install ffmpeg          # macOS
sudo apt install ffmpeg      # Ubuntu/Debian
# Windows : https://www.gyan.dev/ffmpeg/builds/  (ajouter au PATH)
```

Puis, dans le dossier `clipper/` :

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

> Le premier lancement télécharge le modèle Whisper (quelques centaines de Mo).

---

## Utilisation

### Interface web (recommandé)

```bash
./run.sh
# ou :
uvicorn app:app --host 127.0.0.1 --port 8000
```

Ouvre **http://127.0.0.1:8000**, glisse ta vidéo, choisis tes options, clique
sur *Générer les clips*. Tu peux prévisualiser et télécharger chaque short.

### Ligne de commande

```bash
python cli.py ma_video.mp4 -n 8 --aspect 9:16 --model small --out ./clips
```

Options utiles :

| Option        | Défaut  | Description                                  |
|---------------|---------|----------------------------------------------|
| `-n/--num`    | 6       | Nombre de clips à produire                    |
| `--max`       | 60      | Durée max d'un clip (secondes, plafonné à 60) |
| `--min`       | 15      | Durée min d'un clip                           |
| `--model`     | base    | `tiny`/`base`/`small`/`medium` (précision)    |
| `--lang`      | auto    | `fr`, `en`… force la langue                    |
| `--aspect`    | 9:16    | `9:16`, `1:1` ou `original`                    |
| `--fill`      | blur    | `blur` (fond flou) ou `crop` (recadré)         |
| `--no-captions` | —     | Désactive les sous-titres                     |

---

## Structure

```
clipper/
├── app.py               # Serveur web FastAPI + API
├── cli.py               # Version ligne de commande
├── run.sh               # Lancement en une commande
├── requirements.txt
├── static/index.html    # Interface web
└── clip_engine/
    ├── config.py        # Réglages & listes de mots-accroches
    ├── transcribe.py    # Whisper (avec repli si absent)
    ├── highlights.py    # Sélection des meilleurs moments
    ├── render.py        # Montage ffmpeg (recadrage + sous-titres)
    └── pipeline.py      # Orchestration bout-en-bout
```

## Astuces qualité

- **Modèle `small`** donne des sous-titres nettement plus justes que `base`
  (au prix d'un peu de temps).
- Sur une **interview/talking-head** en paysage, `--fill blur` évite de couper
  le visage ; `--fill crop` est plus punchy si le sujet est bien centré.
- Sans faster-whisper installé, l'app découpe quand même la vidéo en tranches
  régulières (utile pour tester ffmpeg), mais sans intelligence ni sous-titres.

*Usage privé / personnel uniquement.*
