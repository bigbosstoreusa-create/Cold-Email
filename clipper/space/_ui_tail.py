
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
