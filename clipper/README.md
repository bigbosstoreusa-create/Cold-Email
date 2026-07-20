# 🎬 Home Clipper

Un clone d'**OpusClip 100 % local**, pour un usage privé à la maison. Tu lui
donnes une longue vidéo (ou un **lien YouTube**), il en sort automatiquement
plusieurs **shorts de 1 minute maximum**, découpés sur les **meilleurs
passages**, recadrés en vertical avec **suivi du visage**, **sous-titres
animés (karaoké)** et un **score de viralité** par clip.

Rien ne quitte ta machine : pas de cloud, pas de compte, pas d'abonnement.

---

## Fonctions (comme OpusClip)

- 🔗 **Import fichier ou lien YouTube** (via `yt-dlp`, usage privé).
- ✂️ **Sélection auto des meilleurs moments** (≤ 60 s), classés par viralité.
- 📊 **Score de viralité 0-100** par clip + badge *Viral / Bon / Moyen*.
- 🎯 **Recadrage 9:16 qui suit le visage** du locuteur (OpenCV) — repli sur
  fond flou / crop centré si aucun visage.
- 💬 **Sous-titres animés karaoké** (mot par mot qui s'allume), style TikTok.
- 😀 **Emojis automatiques** insérés dans les sous-titres selon les mots-clés
  (« argent » 💰, « feu » 🔥, « secret » 🤫…), synchronisés au mot dit.
- 🎞️ **B-roll auto depuis un dossier local** : tes propres plans d'illustration
  s'incrustent quand le mot correspondant est dit.
- 🏷️ **Titre + hashtags** générés automatiquement pour chaque clip.

## Comment ça marche

1. **Transcription** locale avec Whisper (horodatage mot à mot).
2. **Sélection des meilleurs moments** : fenêtres ≤ 60 s pouvant démarrer sur
   une accroche, notées selon des critères transparents — accroches
   (« secret », « erreur », « comment »…), questions, chiffres, énergie de
   parole, longueur idéale — puis retenues sans chevauchement.
3. **Score de viralité** absolu (0-100) calculé sur ces mêmes signaux.
4. **Montage ffmpeg** : découpe, recadrage vertical (suivi du visage / fond
   flou / crop) et sous-titres incrustés facon Shorts/TikTok.

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
python cli.py ma_video.mp4 -n 8 --aspect 9:16 --fill track --model small
python cli.py "https://youtube.com/watch?v=..." -n 10   # depuis un lien
```

Options utiles :

| Option       | Défaut  | Description                                       |
|--------------|---------|---------------------------------------------------|
| `-n/--num`   | 6       | Nombre de clips à produire                         |
| `--max`      | 60      | Durée max d'un clip (secondes, plafonné à 60)      |
| `--min`      | 15      | Durée min d'un clip                                |
| `--model`    | base    | `tiny`/`base`/`small`/`medium` (précision)         |
| `--lang`     | auto    | `fr`, `en`… force la langue                         |
| `--aspect`   | 9:16    | `9:16`, `1:1` ou `original`                         |
| `--fill`     | track   | `track` (suit le visage) / `blur` / `crop`         |
| `--captions` | karaoke | `karaoke` (animés) / `plain` (simples) / `none`    |
| `--no-emojis`| —       | Désactive les emojis dans les sous-titres          |

La sortie affiche le score de viralité et les hashtags de chaque clip.

### B-roll depuis un dossier local

Dépose tes propres vidéos d'illustration dans un dossier, **nommées par
mot-clé** : `argent.mp4`, `ocean_1.mov`, `ville-nuit.webm`… Quand la
transcription prononce ce mot (élisions gérées : « d'argent », « l'océan »),
le plan correspondant est incrusté quelques secondes (l'audio d'origine
continue). Plusieurs fichiers pour un même mot ? Ils sont utilisés à tour de
rôle pour varier.

- **Interface web** : coche *B-roll* → le dossier est `clipper/data/broll/`
  (créé automatiquement). Mets-y tes clips avant de lancer.
- **Ligne de commande** : `python cli.py video.mp4 --broll ./mon_broll`

Réglages avancés (durée d'insert, nombre max) dans `clip_engine/config.py`.

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
    ├── config.py        # Réglages, mots-accroches & seuils de viralité
    ├── transcribe.py    # Whisper (avec repli si absent)
    ├── highlights.py    # Meilleurs moments + score viralité + hashtags
    ├── reframe.py       # Suivi du visage (OpenCV → crop dynamique ffmpeg)
    ├── render.py        # Montage ffmpeg (recadrage + sous-titres + B-roll)
    ├── broll.py         # Index & planification du B-roll local
    ├── fetch.py         # Import depuis un lien (yt-dlp)
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
