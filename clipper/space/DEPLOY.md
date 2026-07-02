# 🌐 Mettre Home Clipper en ligne (lien à ouvrir depuis le téléphone)

Objectif : obtenir une **adresse web** que tu ouvres depuis ton téléphone,
**sans rien installer**. On utilise **Hugging Face Spaces** (gratuit).

Tu fais ça **une seule fois** depuis un navigateur (ordinateur plus confortable,
mais le téléphone marche aussi). Ensuite, tu utilises l'app depuis le lien,
partout.

## Étapes

1. **Crée un compte gratuit** sur https://huggingface.co/join
2. Va sur https://huggingface.co/new-space
3. Remplis :
   - **Space name** : `home-clipper` (ou ce que tu veux)
   - **License** : peu importe (ex. `mit`)
   - **SDK** : choisis **Gradio**
   - **Hardware** : *CPU basic* (gratuit)
   - **Visibility** : **Private** (recommandé — pour toi seulement)
4. Clique **Create Space**.
5. Onglet **Files** → **Add file** → **Upload files**, et dépose ces
   **3 fichiers** (dossier `clipper/space/`) :
   - `app.py`
   - `requirements.txt`
   - `packages.txt`
   > Le `README.md` du Space est déjà créé à l'étape 3. Si tu veux, remplace-le
   > par celui de ce dossier.
6. Valide (**Commit**). Le Space se construit tout seul (2–5 min la 1ʳᵉ fois :
   il installe ffmpeg + les libs).
7. Quand le statut passe à **Running**, ton app est en ligne. L'URL ressemble à :
   `https://huggingface.co/spaces/TON_PSEUDO/home-clipper`
   → ouvre-la depuis ton téléphone, ajoute-la à l'écran d'accueil.

## Protéger l'accès (optionnel)

Space **Private** suffit (toi seul, une fois connecté). Tu peux aussi ajouter un
identifiant/mot de passe : onglet **Settings → Secrets** du Space, ajoute
`APP_USER` et `APP_PASS`. L'app demandera alors un login.

## Bon à savoir (honnête)

- **Vitesse** : le CPU gratuit est lent. Reste sur le modèle **tiny** et des
  vidéos **courtes** (quelques minutes) pour éviter les délais/timeouts. Pour
  aller plus vite, tu peux passer le Space en GPU payant.
- **Lien YouTube** : depuis un serveur cloud, YouTube bloque parfois le
  téléchargement. L'**upload d'un fichier** est le plus fiable.
- **B-roll** : non proposé dans la version en ligne (il faut un dossier local
  de tes propres plans). Utilise la version locale pour ça.
- **Confidentialité** : garde le Space en *Private* pour un usage perso.

## Régénérer `app.py` après une modif du moteur

`app.py` est un fichier unique généré à partir de `clip_engine/`. Si tu changes
le moteur, régénère-le puis re-upload :

```bash
python space/build_app.py
```
