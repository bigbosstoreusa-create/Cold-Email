'use strict';

/**
 * Module REPORT (generation du rapport PDF avec PDFKit)
 * -------------------------------------------------------------------------
 * Rend un MODELE deja localise (issu de i18n.describe) en un document PDF
 * professionnel. Gere :
 *   - la marque blanche (nom + couleur d'accent) ;
 *   - les 3 modeles : client (simple), technical (detaille), exec (1 page) ;
 *   - une page de couverture, le bloc score, l'encart d'exposition financiere,
 *     la note sectorielle, la synthese par categorie, les actions prioritaires,
 *     le detail des controles, le guide de correction, la methodologie/legal ;
 *   - un pied de page numerote sur chaque page.
 *
 * Contrainte : uniquement des caracteres de la police standard (Helvetica).
 * Pas de fleche Unicode, pas d'espace insecable etroite.
 */

const PDFDocument = require('pdfkit');

const PAGE = { width: 595.28, height: 841.89, margin: 50 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;
const LEFT = PAGE.margin;
const RIGHT = PAGE.width - PAGE.margin;
const BOTTOM = PAGE.height - PAGE.margin;

// Palette (theme clair, imprimable et professionnel).
const INK = '#1A1A1F';
const MUTED = '#6B6B73';
const LINE = '#E2E2E6';
const PANEL = '#F5F5F7';
const WHITE = '#FFFFFF';
const RISK_BG = '#FDECEC';
const RISK_BORDER = '#D64545';
const RISK_INK = '#B02A2A';

/** Valide/normalise une couleur hex, avec repli sur l'accent par defaut. */
function color(hex, fallback) {
  if (typeof hex === 'string') {
    const h = hex.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(h)) return h;
    if (/^[0-9a-fA-F]{6}$/.test(h)) return `#${h}`;
  }
  return fallback;
}

/** Ajoute une page si l'espace vertical restant est insuffisant. */
function ensureSpace(doc, needed) {
  if (doc.y + needed > BOTTOM) doc.addPage();
}

/** Titre de section avec une barre d'accent. */
function sectionTitle(doc, text, accent) {
  ensureSpace(doc, 40);
  const y = doc.y;
  doc.save();
  doc.rect(LEFT, y + 1, 4, 16).fill(accent);
  doc.restore();
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(text, LEFT + 12, y);
  doc.moveDown(0.6);
  doc.fillColor(INK).font('Helvetica').fontSize(10);
}

/** Dessine un anneau de score (fond gris + arc colore proportionnel). */
function scoreRing(doc, cx, cy, r, frac, ringColor, score) {
  doc.save();
  // Anneau de fond.
  doc.lineWidth(9).strokeColor('#E7E7EB').circle(cx, cy, r).stroke();
  // Arc proportionnel.
  const f = Math.max(0, Math.min(1, frac));
  if (f >= 0.999) {
    doc.lineWidth(9).strokeColor(ringColor).circle(cx, cy, r).stroke();
  } else if (f > 0) {
    const a0 = -Math.PI / 2;
    const a1 = -Math.PI / 2 + 2 * Math.PI * f;
    const x1 = cx + r * Math.cos(a0);
    const y1 = cy + r * Math.sin(a0);
    const x2 = cx + r * Math.cos(a1);
    const y2 = cy + r * Math.sin(a1);
    const large = f > 0.5 ? 1 : 0;
    doc.lineWidth(9).strokeColor(ringColor).lineCap('round');
    doc.path(`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`).stroke();
  }
  // Texte central.
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(28).text(String(score), cx - r, cy - 20, { width: r * 2, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('/ 100', cx - r, cy + 10, { width: r * 2, align: 'center' });
  doc.restore();
}

/** Petite pastille (compteur) : grand nombre + libelle. */
function counterPill(doc, x, y, w, h, value, label, c) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8).fill(PANEL);
  doc.fillColor(c).font('Helvetica-Bold').fontSize(20).text(String(value), x, y + 10, { width: w, align: 'center' });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(label, x, y + 34, { width: w, align: 'center' });
  doc.restore();
}

/** Badge de statut colore (pastille arrondie avec texte). */
function statusBadge(doc, x, y, label, c) {
  const w = doc.font('Helvetica-Bold').fontSize(8).widthOfString(label) + 14;
  doc.save();
  doc.roundedRect(x, y, w, 15, 7).fill(c);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8).text(label, x, y + 3.5, { width: w, align: 'center' });
  doc.restore();
  return w;
}

/** Page de couverture + bloc score + compteurs. */
function renderCover(doc, model, accent) {
  // Bandeau d'accent.
  doc.save();
  doc.rect(0, 0, PAGE.width, 170).fill(accent);
  // Bouclier stylise (vectoriel, pas de glyphe).
  const sx = RIGHT - 60;
  const sy = 55;
  doc.fillColor(WHITE).opacity(0.9);
  doc.path(`M ${sx} ${sy} L ${sx + 34} ${sy + 12} L ${sx + 34} ${sy + 40} `
    + `C ${sx + 34} ${sy + 58} ${sx + 17} ${sy + 66} ${sx + 17} ${sy + 66} `
    + `C ${sx + 17} ${sy + 66} ${sx} ${sy + 58} ${sx} ${sy + 40} Z`).fill();
  doc.opacity(1);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(24).text(model.brand, LEFT, 52, { width: CONTENT_W - 80 });
  doc.fillColor(WHITE).font('Helvetica').fontSize(13).text(model.ui.reportTitle, LEFT, 88);
  doc.fillColor(WHITE).opacity(0.85).font('Helvetica').fontSize(10)
    .text(`${model.ui.generatedBy} ${model.brand}`, LEFT, 132);
  doc.opacity(1);
  doc.restore();

  // Bloc meta (domaine, secteur, date, profondeur).
  let y = 195;
  const metaRow = (labelKey, value) => {
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(model.ui[labelKey], LEFT, y);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(value, LEFT, y + 11);
    y += 34;
  };
  metaRow('domain', model.domain);
  metaRow('sector', model.sector.label);
  const dateDepth = `${model.generatedAtLabel}   (${model.ui.depth}: ${model.depthLabel})`;
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(model.ui.date, LEFT, y);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(dateDepth, LEFT, y + 11);

  // Anneau de score (a droite).
  const cx = RIGHT - 75;
  const cy = 260;
  scoreRing(doc, cx, cy, 52, (model.score || 0) / 100, model.gradeColor, model.score);
  doc.fillColor(model.gradeColor).font('Helvetica-Bold').fontSize(13)
    .text(`${model.ui.grade}: ${model.gradeKey} - ${model.gradeLabel}`, cx - 90, cy + 62, { width: 180, align: 'center' });

  // Compteurs.
  y = 345;
  const gap = 12;
  const pw = (CONTENT_W - gap * 2) / 3;
  const ph = 54;
  counterPill(doc, LEFT, y, pw, ph, model.counts.fail, model.countsLabel.fail, '#D64545');
  counterPill(doc, LEFT + pw + gap, y, pw, ph, model.counts.warn, model.countsLabel.warn, '#E0A410');
  counterPill(doc, LEFT + (pw + gap) * 2, y, pw, ph, model.counts.pass, model.countsLabel.pass, '#1FA971');

  doc.y = y + ph + 18;
  doc.x = LEFT;
}

/** Encart rouge d'exposition financiere estimee. */
function exposureBox(doc, model) {
  if (!model.exposure) return;
  ensureSpace(doc, 100);
  const y = doc.y;
  const h = 82;
  doc.save();
  doc.roundedRect(LEFT, y, CONTENT_W, h, 8).fillAndStroke(RISK_BG, RISK_BORDER);
  doc.fillColor(RISK_INK).font('Helvetica-Bold').fontSize(11).text(model.exposure.title, LEFT + 16, y + 12);
  const amount = model.exposure.hasRisk ? model.exposure.rangeFormatted : model.exposure.lowFormatted;
  doc.fillColor(RISK_BORDER).font('Helvetica-Bold').fontSize(22).text(amount, LEFT + 16, y + 30);
  doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8.5).text(model.exposure.disclaimer, LEFT + 16, y + 60);
  doc.restore();
  doc.y = y + h + 16;
  doc.x = LEFT;
}

/** Note sectorielle (enjeux). */
function sectorNote(doc, model, accent) {
  sectionTitle(doc, model.ui.sectorNoteTitle, accent);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(model.sector.label, LEFT, doc.y);
  doc.moveDown(0.2);
  doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(model.sector.note, LEFT, doc.y, { width: CONTENT_W, align: 'justify' });
  doc.moveDown(0.8);
  doc.x = LEFT;
}

/** Synthese par categorie (tableau compteurs). */
function summaryTable(doc, model, accent) {
  sectionTitle(doc, model.ui.summaryTitle, accent);
  const startY = doc.y;
  const col = { cat: LEFT + 8, fail: LEFT + 300, warn: LEFT + 370, pass: LEFT + 440 };
  // En-tete.
  doc.save();
  doc.rect(LEFT, startY, CONTENT_W, 20).fill(accent);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9);
  doc.text(model.ui.category, col.cat, startY + 6);
  doc.text(model.countsLabel.fail, col.fail, startY + 6);
  doc.text(model.countsLabel.warn, col.warn, startY + 6);
  doc.text(model.countsLabel.pass, col.pass, startY + 6);
  doc.restore();

  let y = startY + 20;
  doc.font('Helvetica').fontSize(9.5);
  model.categories.forEach((cat, idx) => {
    const rowH = 20;
    if (idx % 2 === 1) { doc.save(); doc.rect(LEFT, y, CONTENT_W, rowH).fill(PANEL); doc.restore(); }
    const f = cat.checks.filter((c) => c.status === 'fail').length;
    const w = cat.checks.filter((c) => c.status === 'warn').length;
    const p = cat.checks.filter((c) => c.status === 'pass').length;
    doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(cat.label, col.cat, y + 6, { width: 280 });
    doc.fillColor('#D64545').text(String(f), col.fail, y + 6);
    doc.fillColor('#E0A410').text(String(w), col.warn, y + 6);
    doc.fillColor('#1FA971').text(String(p), col.pass, y + 6);
    y += rowH;
  });
  doc.save();
  doc.lineWidth(0.5).strokeColor(LINE).rect(LEFT, startY, CONTENT_W, y - startY).stroke();
  doc.restore();
  doc.y = y + 16;
  doc.x = LEFT;
}

/** Actions prioritaires (liste courte). */
function priorityActions(doc, model, accent, limit) {
  const actions = model.priorityActions.slice(0, limit || model.priorityActions.length);
  sectionTitle(doc, model.ui.priorityTitle, accent);
  if (!actions.length) {
    doc.fillColor('#1FA971').font('Helvetica-Bold').fontSize(10).text(model.ui.noIssues, LEFT, doc.y);
    doc.moveDown(0.8);
    doc.x = LEFT;
    return;
  }
  actions.forEach((a, i) => {
    ensureSpace(doc, 30);
    const y = doc.y;
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(10).text(`${i + 1}.`, LEFT, y, { width: 18 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(a.title, LEFT + 20, y, { width: CONTENT_W - 90 });
    statusBadge(doc, RIGHT - 62, y, a.statusLabel, a.statusColor);
    if (a.recommendation) {
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(a.recommendation, LEFT + 20, doc.y + 1, { width: CONTENT_W - 40 });
    }
    doc.moveDown(0.5);
  });
  doc.moveDown(0.3);
  doc.x = LEFT;
}

/** Detail de chaque controle, groupe par categorie. */
function detailChecks(doc, model, accent, showEvidence) {
  doc.addPage();
  sectionTitle(doc, model.ui.detailTitle, accent);
  model.categories.forEach((cat) => {
    ensureSpace(doc, 40);
    // Bandeau de categorie.
    const yc = doc.y;
    doc.save();
    doc.roundedRect(LEFT, yc, CONTENT_W, 18, 4).fill('#2A2A31');
    doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9.5).text(cat.label, LEFT + 8, yc + 4.5);
    doc.restore();
    doc.y = yc + 24;

    cat.checks.forEach((c) => {
      ensureSpace(doc, 50);
      const y = doc.y;
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(c.title, LEFT, y, { width: CONTENT_W - 80 });
      statusBadge(doc, RIGHT - 70, y, c.statusLabel, c.statusColor);
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(c.message, LEFT, doc.y + 1, { width: CONTENT_W });
      if (showEvidence && c.evidence) {
        doc.fillColor('#8A8A93').font('Helvetica-Oblique').fontSize(8.5)
          .text(`${model.ui.evidence}: ${c.evidence}`, LEFT, doc.y + 1, { width: CONTENT_W });
      }
      if (c.recommendation) {
        doc.fillColor(accent).font('Helvetica').fontSize(9)
          .text(`${model.ui.recommendation}: ${c.recommendation}`, LEFT, doc.y + 1, { width: CONTENT_W });
      }
      doc.moveDown(0.6);
      // Separateur fin.
      doc.save();
      doc.lineWidth(0.5).strokeColor(LINE).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
      doc.restore();
      doc.moveDown(0.4);
    });
    doc.moveDown(0.3);
  });
}

/** Guide de correction pas a pas (failles triees par priorite). */
function remediationGuide(doc, model, accent) {
  if (!model.remediationGuide.length) return;
  doc.addPage();
  sectionTitle(doc, model.ui.remediationTitle, accent);
  model.remediationGuide.forEach((item) => {
    ensureSpace(doc, 60);
    const y = doc.y;
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(11).text(`${item.rank}.`, LEFT, y, { width: 22 });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(item.title, LEFT + 22, y, { width: CONTENT_W - 90 });
    statusBadge(doc, RIGHT - 70, y + 1, item.statusLabel, item.statusColor);
    doc.y = Math.max(doc.y, y + 16);
    (item.steps || []).forEach((step, i) => {
      ensureSpace(doc, 26);
      const sy = doc.y;
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text(`${i + 1}.`, LEFT + 22, sy, { width: 16 });
      doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(step, LEFT + 40, sy, { width: CONTENT_W - 40 });
      doc.moveDown(0.25);
    });
    doc.moveDown(0.7);
  });
}

/** Methodologie et rappel legal. */
function methodologyLegal(doc, model, accent) {
  ensureSpace(doc, 140);
  sectionTitle(doc, model.ui.methodologyTitle, accent);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(model.methodology, LEFT, doc.y, { width: CONTENT_W, align: 'justify' });
  doc.moveDown(0.6);
  doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8.5).text(model.legal, LEFT, doc.y, { width: CONTENT_W, align: 'justify' });
  doc.x = LEFT;
}

/** Modele DIRECTION : synthese compacte (couverture + l'essentiel). */
function renderExec(doc, model, accent) {
  exposureBox(doc, model);
  priorityActions(doc, model, accent, 5);
  ensureSpace(doc, 60);
  doc.fillColor(MUTED).font('Helvetica-Oblique').fontSize(8.5)
    .text(model.legal, LEFT, doc.y, { width: CONTENT_W, align: 'justify' });
  doc.x = LEFT;
}

/** Pied de page numerote sur chaque page. */
function addFooters(doc, model, accent) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(range.start + i);
    const y = BOTTOM + 14;
    doc.save();
    doc.lineWidth(0.5).strokeColor(LINE).moveTo(LEFT, y).lineTo(RIGHT, y).stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(`${model.brand} - ${model.domain}`, LEFT, y + 5, { width: CONTENT_W / 2, align: 'left', lineBreak: false });
    doc.text(`${model.ui.page} ${i + 1} / ${total}`, LEFT + CONTENT_W / 2, y + 5, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
    doc.restore();
  }
}

/**
 * Construit le PDF et le pipe vers un flux (reponse HTTP ou fichier).
 * @param {object} model modele localise (i18n.describe)
 * @param {WritableStream} stream destination
 * @returns {PDFDocument}
 */
function build(model, stream) {
  const accent = color(model.accent, '#F26419');
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE.margin,
    bufferPages: true,
    info: { Title: `${model.ui.reportTitle} - ${model.domain}`, Author: model.brand }
  });
  doc.pipe(stream);

  renderCover(doc, model, accent);

  if (model.template === 'exec') {
    renderExec(doc, model, accent);
  } else {
    exposureBox(doc, model);
    sectorNote(doc, model, accent);
    summaryTable(doc, model, accent);
    priorityActions(doc, model, accent);
    detailChecks(doc, model, accent, model.template === 'technical');
    remediationGuide(doc, model, accent);
    doc.addPage();
    methodologyLegal(doc, model, accent);
  }

  addFooters(doc, model, accent);
  doc.end();
  return doc;
}

module.exports = { build };
