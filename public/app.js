'use strict';

/* =========================================================================
   CyberAudit - Logique frontend (JavaScript vanilla, aucune dependance)
   - Gere le paywall (cle / admin), l'audit, l'affichage bilingue instantane,
     la marque blanche en direct, le message de prospection, les exports.
   - Conserve un resultat BRUT neutre cote client pour re-localiser FR/EN
     sans relancer le scan reseau (route /api/localize).
   ========================================================================= */

(function () {
  // ------------------------- Dictionnaire d'interface -------------------------
  var I18N = {
    fr: {
      'unlock.subtitle': "Scanner de securite de sites web, non intrusif, avec rapports PDF professionnels.",
      'unlock.priceOnce': "acces a vie, paiement unique",
      'unlock.getAccess': "Obtenir l'acces",
      'unlock.or': 'ou',
      'unlock.haveKey': "J'ai deja une cle d'acces",
      'unlock.keyPlaceholder': 'CYBER-XXXX-XXXX-XXXX',
      'unlock.unlockBtn': 'Deverrouiller',
      'unlock.adminLink': 'Connexion admin',
      'unlock.adminTitle': 'Connexion administrateur',
      'unlock.emailPlaceholder': 'Adresse e-mail',
      'unlock.passwordPlaceholder': 'Mot de passe',
      'unlock.adminBtn': 'Se connecter',
      'unlock.backLink': "Retour a la cle d'acces",
      'unlock.legalNote': "N'auditez que des domaines qui vous appartiennent ou pour lesquels vous avez une autorisation.",
      'app.admin': 'Admin',
      'warn.authorized': "N'auditez que des domaines qui vous appartiennent ou pour lesquels vous avez une autorisation. Cet outil est passif et non intrusif.",
      'form.title': 'Lancer un audit de securite',
      'form.subtitle': 'Analyse a distance, passive, sur informations publiques uniquement.',
      'form.domain': 'Domaine a auditer',
      'form.domainPlaceholder': 'exemple.com',
      'form.sector': "Secteur d'activite",
      'form.depth': "Profondeur d'audit",
      'form.currency': 'Devise du risque',
      'form.template': 'Modele de rapport',
      'form.tone': 'Ton du message de prospection',
      'form.format': "Format d'export",
      'form.competitor': 'Comparer avec un concurrent (optionnel)',
      'form.competitorPlaceholder': 'concurrent.com',
      'form.run': "Lancer l'audit",
      'form.running': 'Analyse en cours (non intrusive)...',
      'brandPanel.title': 'Marque blanche',
      'brandPanel.nameLabel': 'Nom de votre marque',
      'brandPanel.namePlaceholder': 'Votre marque',
      'brandPanel.colorLabel': "Couleur d'accent",
      'brandPanel.reset': 'Reinitialiser',
      'footer.tagline': 'Scanner de securite non intrusif. Estimations indicatives.',
      'res.outreachTitle': 'Message de prospection',
      'res.copy': 'Copier',
      'res.copied': 'Copie !',
      'res.reportFr': 'Rapport PDF (FR)',
      'res.reportEn': 'Report PDF (EN)',
      'res.reportFrHtml': 'Page HTML (FR)',
      'res.reportEnHtml': 'Page HTML (EN)',
      'res.reportFrText': 'Resume texte (FR)',
      'res.reportEnText': 'Resume texte (EN)',
      'res.reportTitle': 'Telecharger le rapport',
      'res.exportNotePdf': "Le format choisi est le PDF. Modifiez le menu Format d'export pour une page HTML ou un resume texte.",
      'res.exportNoteHtml': "Format HTML imprimable : une page s'ouvre, pretes a imprimer ou enregistrer en PDF.",
      'res.exportNoteText': 'Format texte : un resume a copier-coller est telecharge.',
      'res.compareTitle': 'Comparatif de scores',
      'res.vs': 'vs',
      'res.competitorError': 'Impossible de scanner le domaine concurrent.',
      'err.network': 'Erreur reseau. Verifiez votre connexion et reessayez.',
      'err.scan': "L'audit a echoue. Reessayez.",
      'err.unlockKey': "Cle d'acces invalide.",
      'err.emptyDomain': 'Veuillez saisir un domaine.'
    },
    en: {
      'unlock.subtitle': 'Non-intrusive website security scanner with professional PDF reports.',
      'unlock.priceOnce': 'lifetime access, one-time payment',
      'unlock.getAccess': 'Get access',
      'unlock.or': 'or',
      'unlock.haveKey': 'I already have an access key',
      'unlock.keyPlaceholder': 'CYBER-XXXX-XXXX-XXXX',
      'unlock.unlockBtn': 'Unlock',
      'unlock.adminLink': 'Admin login',
      'unlock.adminTitle': 'Administrator login',
      'unlock.emailPlaceholder': 'E-mail address',
      'unlock.passwordPlaceholder': 'Password',
      'unlock.adminBtn': 'Sign in',
      'unlock.backLink': 'Back to access key',
      'unlock.legalNote': 'Only audit domains that you own or for which you have authorization.',
      'app.admin': 'Admin',
      'warn.authorized': 'Only audit domains that you own or for which you have authorization. This tool is passive and non-intrusive.',
      'form.title': 'Run a security audit',
      'form.subtitle': 'Remote, passive analysis, based on public information only.',
      'form.domain': 'Domain to audit',
      'form.domainPlaceholder': 'example.com',
      'form.sector': 'Business sector',
      'form.depth': 'Audit depth',
      'form.currency': 'Risk currency',
      'form.template': 'Report template',
      'form.tone': 'Prospecting message tone',
      'form.format': 'Export format',
      'form.competitor': 'Compare with a competitor (optional)',
      'form.competitorPlaceholder': 'competitor.com',
      'form.run': 'Run the audit',
      'form.running': 'Analysis in progress (non-intrusive)...',
      'brandPanel.title': 'White label',
      'brandPanel.nameLabel': 'Your brand name',
      'brandPanel.namePlaceholder': 'Your brand',
      'brandPanel.colorLabel': 'Accent color',
      'brandPanel.reset': 'Reset',
      'footer.tagline': 'Non-intrusive security scanner. Indicative estimates.',
      'res.outreachTitle': 'Prospecting message',
      'res.copy': 'Copy',
      'res.copied': 'Copied!',
      'res.reportFr': 'Rapport PDF (FR)',
      'res.reportEn': 'Report PDF (EN)',
      'res.reportFrHtml': 'HTML page (FR)',
      'res.reportEnHtml': 'HTML page (EN)',
      'res.reportFrText': 'Text summary (FR)',
      'res.reportEnText': 'Text summary (EN)',
      'res.reportTitle': 'Download the report',
      'res.exportNotePdf': 'The chosen format is PDF. Change the Export format menu for an HTML page or a text summary.',
      'res.exportNoteHtml': 'Printable HTML format: a page opens, ready to print or save as PDF.',
      'res.exportNoteText': 'Text format: a copy-paste summary is downloaded.',
      'res.compareTitle': 'Score comparison',
      'res.vs': 'vs',
      'res.competitorError': 'Could not scan the competitor domain.',
      'err.network': 'Network error. Check your connection and try again.',
      'err.scan': 'The audit failed. Please try again.',
      'err.unlockKey': 'Invalid access key.',
      'err.emptyDomain': 'Please enter a domain.'
    }
  };

  var FEATURES = {
    fr: [
      '18 controles de securite reels (SSL/TLS, en-tetes, e-mail, DNS)',
      'Rapport PDF professionnel dans 2 langues (FR / EN)',
      'Guide de correction pas a pas pour chaque faille',
      'Exposition financiere estimee et note sectorielle',
      'Marque blanche : votre nom et votre couleur',
      'Message de prospection genere automatiquement'
    ],
    en: [
      '18 real security checks (SSL/TLS, headers, e-mail, DNS)',
      'Professional PDF report in 2 languages (FR / EN)',
      'Step-by-step remediation guide for every issue',
      'Estimated financial exposure and sector note',
      'White label: your name and your color',
      'Automatically generated prospecting message'
    ]
  };

  // Options des menus deroulants (valeur + libelles bilingues).
  var OPTIONS = {
    depth: [
      { v: 'quick', fr: 'Rapide', en: 'Quick' },
      { v: 'standard', fr: 'Standard', en: 'Standard' },
      { v: 'deep', fr: 'Approfondi', en: 'Deep' }
    ],
    currency: [
      { v: 'EUR', fr: 'Euro (€)', en: 'Euro (€)' },
      { v: 'USD', fr: 'Dollar US ($)', en: 'US Dollar ($)' },
      { v: 'GBP', fr: 'Livre (£)', en: 'Pound (£)' },
      { v: 'CAD', fr: 'Dollar canadien (CA$)', en: 'Canadian Dollar (CA$)' },
      { v: 'CHF', fr: 'Franc suisse (CHF)', en: 'Swiss Franc (CHF)' }
    ],
    template: [
      { v: 'client', fr: 'Client (simple)', en: 'Client (simple)' },
      { v: 'technical', fr: 'Technique (detaille)', en: 'Technical (detailed)' },
      { v: 'exec', fr: 'Direction (synthese)', en: 'Executive (summary)' }
    ],
    tone: [
      { v: 'direct', fr: 'Direct', en: 'Direct' },
      { v: 'friendly', fr: 'Amical', en: 'Friendly' },
      { v: 'formal', fr: 'Formel', en: 'Formal' },
      { v: 'urgent', fr: 'Urgent', en: 'Urgent' }
    ],
    format: [
      { v: 'pdf', fr: 'PDF', en: 'PDF' },
      { v: 'html', fr: 'Page HTML imprimable', en: 'Printable HTML page' },
      { v: 'text', fr: 'Resume texte', en: 'Text summary' }
    ]
  };

  // ------------------------------- Etat --------------------------------------
  var state = {
    lang: 'fr',
    accessCode: '',
    isAdmin: false,
    config: null,
    sectors: [],
    lastRaw: null,
    lastScan: null,
    competitorRaw: null,
    competitorScan: null,
    brand: '',
    accent: '#F26419'
  };

  var $ = function (sel) { return document.querySelector(sel); };
  var el = function (id) { return document.getElementById(id); };

  function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || (I18N.fr[key]) || key; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // --------------------------- Stockage local --------------------------------
  function save(k, v) { try { localStorage.setItem('cyberaudit.' + k, v); } catch (e) { /* ignore */ } }
  function load(k) { try { return localStorage.getItem('cyberaudit.' + k); } catch (e) { return null; } }

  // ------------------------------- API ---------------------------------------
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (state.accessCode) headers['x-access-code'] = state.accessCode;
    var init = { method: opts.method || 'GET', headers: headers };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(path, init);
  }

  function apiJson(path, opts) {
    return api(path, opts).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; });
    });
  }

  // --------------------------- Application i18n -------------------------------
  function applyI18n() {
    document.documentElement.lang = state.lang;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
    var phs = document.querySelectorAll('[data-i18n-ph]');
    for (var j = 0; j < phs.length; j++) {
      phs[j].setAttribute('placeholder', t(phs[j].getAttribute('data-i18n-ph')));
    }
    // Liste des fonctionnalites (ecran de deverrouillage).
    var list = el('featuresList');
    if (list) {
      list.innerHTML = '';
      FEATURES[state.lang].forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f;
        list.appendChild(li);
      });
    }
    el('langSelect').value = state.lang;
    el('unlockLangSelect').value = state.lang;
  }

  function fillSelect(select, items) {
    var current = select.value;
    select.innerHTML = '';
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.v;
      o.textContent = it[state.lang] || it.fr;
      select.appendChild(o);
    });
    if (current) select.value = current;
  }

  function populateMenus() {
    fillSelect(el('depthSelect'), OPTIONS.depth);
    fillSelect(el('currencySelect'), OPTIONS.currency);
    fillSelect(el('templateSelect'), OPTIONS.template);
    fillSelect(el('toneSelect'), OPTIONS.tone);
    fillSelect(el('formatSelect'), OPTIONS.format);
    // Secteurs (depuis l'API, libelles fr/en).
    var sectorSel = el('sectorSelect');
    var currentSector = sectorSel.value;
    sectorSel.innerHTML = '';
    state.sectors.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = s[state.lang] || s.fr;
      sectorSel.appendChild(o);
    });
    if (currentSector) sectorSel.value = currentSector;
    // Defaut devise EUR.
    if (!currentSector) el('currencySelect').value = 'EUR';
  }

  // ----------------------------- Marque blanche ------------------------------
  function applyAccent() {
    document.documentElement.style.setProperty('--accent', state.accent);
    el('accentInput').value = /^#[0-9a-fA-F]{6}$/.test(state.accent) ? state.accent : '#F26419';
    el('accentValue').textContent = state.accent;
  }
  function applyBrand() {
    var b = state.brand || 'CyberAudit';
    el('unlockBrand').textContent = b;
    el('appBrand').textContent = b;
    el('footerBrand').textContent = b;
  }

  // ----------------------------- Deverrouillage ------------------------------
  function showApp() {
    el('unlock').hidden = true;
    el('app').hidden = false;
    el('adminBadge').hidden = !state.isAdmin;
  }
  function showUnlock() {
    el('unlock').hidden = false;
    el('app').hidden = true;
  }

  function tryUnlockWithKey(code) {
    state.accessCode = code;
    return apiJson('/api/access/status').then(function (res) {
      if (res.ok && res.data && res.data.valid) {
        save('accessCode', code);
        return true;
      }
      state.accessCode = '';
      return false;
    }).catch(function () { state.accessCode = ''; return false; });
  }

  function wireUnlock() {
    // Bouton "Obtenir l'acces".
    el('getAccessBtn').addEventListener('click', function (e) {
      var url = state.config && state.config.paymentUrl;
      if (!url) { e.preventDefault(); alert(state.lang === 'en' ? 'Payment link not configured.' : 'Lien de paiement non configure.'); }
    });

    el('unlockBtn').addEventListener('click', function () {
      var code = el('accessKeyInput').value.trim();
      var msg = el('keyMsg');
      msg.textContent = '';
      if (!code) { msg.className = 'msg error'; msg.textContent = t('err.unlockKey'); return; }
      tryUnlockWithKey(code).then(function (ok) {
        if (ok) { state.isAdmin = false; save('isAdmin', '0'); showApp(); }
        else { msg.className = 'msg error'; msg.textContent = t('err.unlockKey'); }
      });
    });
    el('accessKeyInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') el('unlockBtn').click(); });

    el('showAdminBtn').addEventListener('click', function () {
      el('keyForm').hidden = true; el('adminForm').hidden = false;
    });
    el('backToKeyBtn').addEventListener('click', function () {
      el('adminForm').hidden = true; el('keyForm').hidden = false;
    });

    el('adminBtn').addEventListener('click', function () {
      var email = el('adminEmail').value.trim();
      var password = el('adminPassword').value;
      var msg = el('adminMsg');
      msg.textContent = '';
      apiJson('/api/access/admin', { method: 'POST', body: { email: email, password: password, lang: state.lang } })
        .then(function (res) {
          if (res.ok && res.data && res.data.valid) {
            state.accessCode = res.data.code;
            state.isAdmin = true;
            save('accessCode', res.data.code);
            save('isAdmin', '1');
            showApp();
          } else {
            msg.className = 'msg error';
            msg.textContent = (res.data && res.data.message) || (state.lang === 'en' ? 'Incorrect e-mail or password.' : 'E-mail ou mot de passe incorrect.');
          }
        }).catch(function () { msg.className = 'msg error'; msg.textContent = t('err.network'); });
    });
    el('adminPassword').addEventListener('keydown', function (e) { if (e.key === 'Enter') el('adminBtn').click(); });
  }

  // -------------------------------- Audit ------------------------------------
  function currentOptions() {
    return {
      sector: el('sectorSelect').value,
      depth: el('depthSelect').value,
      currency: el('currencySelect').value,
      template: el('templateSelect').value,
      tone: el('toneSelect').value,
      brand: state.brand || undefined,
      accent: state.accent
    };
  }

  function runAudit() {
    var domain = el('domainInput').value.trim();
    var competitor = el('competitorInput').value.trim();
    if (!domain) { alert(t('err.emptyDomain')); return; }

    el('results').hidden = true;
    el('loading').hidden = false;
    el('runBtn').disabled = true;

    var opts = currentOptions();
    var body = Object.assign({ domain: domain, lang: state.lang }, opts);

    apiJson('/api/scan', { method: 'POST', body: body }).then(function (res) {
      if (res.status === 401) { showUnlock(); throw new Error('unauthorized'); }
      if (!res.ok || !res.data || !res.data.scan) {
        var m = (res.data && res.data.message) || t('err.scan');
        throw new Error(m);
      }
      state.lastRaw = res.data.raw;
      state.lastScan = res.data.scan;
      state.competitorRaw = null;
      state.competitorScan = null;

      // Comparaison concurrent (optionnelle).
      if (competitor) {
        var cbody = Object.assign({ domain: competitor, lang: state.lang }, opts);
        return apiJson('/api/scan', { method: 'POST', body: cbody }).then(function (cres) {
          if (cres.ok && cres.data && cres.data.scan) {
            state.competitorRaw = cres.data.raw;
            state.competitorScan = cres.data.scan;
          }
          return true;
        }).catch(function () { return true; });
      }
      return true;
    }).then(function () {
      renderResults();
    }).catch(function (e) {
      if (e && e.message !== 'unauthorized') {
        alert(e.message || t('err.network'));
      }
    }).then(function () {
      el('loading').hidden = true;
      el('runBtn').disabled = false;
    });
  }

  // ---------------------- Re-localisation (changement langue/marque) ---------
  function relocalize() {
    if (!state.lastRaw) return Promise.resolve();
    var opts = currentOptions();
    var tasks = [];
    var mainBody = Object.assign({ raw: state.lastRaw, lang: state.lang }, opts);
    tasks.push(apiJson('/api/localize', { method: 'POST', body: mainBody }).then(function (res) {
      if (res.ok && res.data && res.data.scan) state.lastScan = res.data.scan;
    }));
    if (state.competitorRaw) {
      var cBody = Object.assign({ raw: state.competitorRaw, lang: state.lang }, opts);
      tasks.push(apiJson('/api/localize', { method: 'POST', body: cBody }).then(function (res) {
        if (res.ok && res.data && res.data.scan) state.competitorScan = res.data.scan;
      }));
    }
    return Promise.all(tasks).then(function () { renderResults(); }).catch(function () {});
  }

  // ------------------------------ Rendu resultats ----------------------------
  function ringSvg(score, colorHex) {
    var r = 58, c = 2 * Math.PI * r;
    var arc = Math.max(0, Math.min(1, (score || 0) / 100)) * c;
    return '<div class="ring-wrap"><svg width="132" height="132" viewBox="0 0 132 132" aria-hidden="true">'
      + '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="#2B2B33" stroke-width="10"/>'
      + '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="' + esc(colorHex) + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + arc.toFixed(1) + ' ' + c.toFixed(1) + '"/>'
      + '</svg><div class="ring-center"><span class="ring-score">' + esc(score) + '</span><span class="ring-out">/ 100</span></div></div>';
  }

  function renderResults() {
    var m = state.lastScan;
    if (!m) return;
    var out = [];

    // 1) Carte score.
    out.push('<div class="score-card">');
    out.push(ringSvg(m.score, m.gradeColor));
    out.push('<div class="score-meta">');
    out.push('<div class="grade-line"><span class="grade-pill" style="background:' + esc(m.gradeColor) + '">' + esc(m.gradeKey) + ' - ' + esc(m.gradeLabel) + '</span></div>');
    out.push('<div class="grade-desc">' + esc(m.gradeDescription) + '</div>');
    out.push('<div class="counters">');
    out.push('<div class="counter fail"><div class="counter-num">' + esc(m.counts.fail) + '</div><div class="counter-label">' + esc(m.countsLabel.fail) + '</div></div>');
    out.push('<div class="counter warn"><div class="counter-num">' + esc(m.counts.warn) + '</div><div class="counter-label">' + esc(m.countsLabel.warn) + '</div></div>');
    out.push('<div class="counter pass"><div class="counter-num">' + esc(m.counts.pass) + '</div><div class="counter-label">' + esc(m.countsLabel.pass) + '</div></div>');
    out.push('</div></div></div>');

    // 2) Encart exposition financiere.
    if (m.exposure) {
      var amount = m.exposure.hasRisk ? m.exposure.rangeFormatted : m.exposure.lowFormatted;
      out.push('<div class="risk-box"><div class="risk-title">' + esc(m.exposure.title) + '</div>'
        + '<div class="risk-amount">' + esc(amount) + '</div>'
        + '<div class="risk-disclaimer">' + esc(m.exposure.disclaimer) + '</div></div>');
    }

    // 3) Note sectorielle.
    out.push('<div class="section-card"><h2>' + esc(m.ui.sectorNoteTitle) + '</h2>'
      + '<div class="sector-name">' + esc(m.sector.label) + '</div>'
      + '<p>' + esc(m.sector.note) + '</p></div>');

    // 4) Comparaison concurrent.
    if (state.competitorScan) {
      var cm = state.competitorScan;
      out.push('<div class="section-card"><h2>' + esc(t('res.compareTitle')) + '</h2><div class="compare-grid">');
      out.push('<div class="compare-side"><div class="compare-domain">' + esc(m.domain) + '</div>'
        + '<div class="compare-score" style="color:' + esc(m.gradeColor) + '">' + esc(m.score) + '</div>'
        + '<div class="compare-grade">' + esc(m.gradeKey) + ' - ' + esc(m.gradeLabel) + '</div></div>');
      out.push('<div class="compare-vs">' + esc(t('res.vs')) + '</div>');
      out.push('<div class="compare-side"><div class="compare-domain">' + esc(cm.domain) + '</div>'
        + '<div class="compare-score" style="color:' + esc(cm.gradeColor) + '">' + esc(cm.score) + '</div>'
        + '<div class="compare-grade">' + esc(cm.gradeKey) + ' - ' + esc(cm.gradeLabel) + '</div></div>');
      out.push('</div></div>');
    }

    // 5) Message de prospection.
    out.push('<div class="section-card outreach"><div class="outreach-head"><h2>' + esc(t('res.outreachTitle')) + '</h2>'
      + '<button id="copyOutreach" class="btn btn-ghost">' + esc(t('res.copy')) + '</button></div>'
      + '<textarea id="outreachText" spellcheck="false" readonly></textarea></div>');

    // 6) Boutons de rapport.
    var fmt = el('formatSelect').value;
    var labelFr = fmt === 'html' ? t('res.reportFrHtml') : (fmt === 'text' ? t('res.reportFrText') : t('res.reportFr'));
    var labelEn = fmt === 'html' ? t('res.reportEnHtml') : (fmt === 'text' ? t('res.reportEnText') : t('res.reportEn'));
    var note = fmt === 'html' ? t('res.exportNoteHtml') : (fmt === 'text' ? t('res.exportNoteText') : t('res.exportNotePdf'));
    out.push('<div class="section-card"><h2>' + esc(t('res.reportTitle')) + '</h2><div class="report-actions">'
      + '<button id="reportFr" class="btn btn-accent">' + esc(labelFr) + '</button>'
      + '<button id="reportEn" class="btn btn-accent">' + esc(labelEn) + '</button>'
      + '</div><p class="export-note">' + esc(note) + '</p></div>');

    // 7) Detail des controles par categorie.
    out.push('<div class="section-card"><h2>' + esc(m.ui.detailTitle) + '</h2></div>');
    m.categories.forEach(function (cat) {
      out.push('<div class="cat"><div class="cat-head"><h3>' + esc(cat.label) + '</h3><div class="cat-mini">');
      cat.checks.forEach(function (c) { out.push('<span class="dot ' + esc(c.status) + '" title="' + esc(c.statusLabel) + '"></span>'); });
      out.push('</div></div>');
      cat.checks.forEach(function (c) {
        out.push('<div class="check"><div class="check-head"><div>'
          + '<div class="check-title">' + esc(c.title) + '</div>'
          + '<div class="check-msg">' + esc(c.message) + '</div>'
          + (c.evidence ? '<div class="check-evidence">' + esc(c.evidence) + '</div>' : '')
          + '</div><span class="status-badge ' + esc(c.status) + '">' + esc(c.statusLabel) + '</span></div>');
        if (c.remediation && c.remediation.length) {
          out.push('<details class="fixwrap"><summary class="fix-summary">' + esc(m.ui.howToFix) + ' (' + c.remediation.length + ' ' + esc(m.ui.steps) + ')</summary>'
            + '<div class="fix-steps">'
            + (c.recommendation ? '<p class="fix-reco">' + esc(c.recommendation) + '</p>' : '')
            + '<ol>' + c.remediation.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div></details>');
        }
        out.push('</div>');
      });
      out.push('</div>');
    });

    var results = el('results');
    results.innerHTML = out.join('');
    results.hidden = false;

    // Post-rendu : remplir le message et cabler les boutons.
    el('outreachText').value = m.outreach.text;
    el('copyOutreach').addEventListener('click', function () {
      copyText(m.outreach.text, el('copyOutreach'));
    });
    el('reportFr').addEventListener('click', function () { downloadReport('fr'); });
    el('reportEn').addEventListener('click', function () { downloadReport('en'); });

    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ------------------------------- Copier -----------------------------------
  function copyText(text, btn) {
    var done = function () {
      if (!btn) return;
      var old = btn.textContent;
      btn.textContent = t('res.copied');
      setTimeout(function () { btn.textContent = old; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  // ------------------------------- Exports -----------------------------------
  function getModelForLang(lang) {
    // Reutilise le scan courant si la langue correspond, sinon re-localise.
    if (lang === state.lang && state.lastScan) return Promise.resolve(state.lastScan);
    var body = Object.assign({ raw: state.lastRaw, lang: lang }, currentOptions());
    return apiJson('/api/localize', { method: 'POST', body: body }).then(function (res) {
      return (res.ok && res.data && res.data.scan) ? res.data.scan : state.lastScan;
    });
  }

  function downloadReport(lang) {
    var fmt = el('formatSelect').value;
    if (fmt === 'html') return exportHtml(lang);
    if (fmt === 'text') return exportText(lang);
    return downloadPdf(lang);
  }

  function downloadPdf(lang) {
    var body = Object.assign({ raw: state.lastRaw, lang: lang }, currentOptions());
    return api('/api/report', { method: 'POST', body: body }).then(function (r) {
      if (!r.ok) throw new Error('report');
      return r.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'cyberaudit-' + (state.lastScan ? state.lastScan.domain : 'rapport') + '-' + lang + '.pdf';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }).catch(function () { alert(t('err.network')); });
  }

  function buildTextReport(m) {
    var lines = [];
    lines.push(m.ui.reportTitle.toUpperCase());
    lines.push('======================================');
    lines.push(m.ui.domain + ' : ' + m.domain);
    lines.push(m.ui.sector + ' : ' + m.sector.label);
    lines.push(m.ui.date + ' : ' + m.generatedAtLabel);
    lines.push(m.ui.score + ' : ' + m.score + '/100 (' + m.gradeKey + ' - ' + m.gradeLabel + ')');
    lines.push(m.countsLabel.fail + ': ' + m.counts.fail + '  ' + m.countsLabel.warn + ': ' + m.counts.warn + '  ' + m.countsLabel.pass + ': ' + m.counts.pass);
    if (m.exposure && m.exposure.hasRisk) {
      lines.push('');
      lines.push(m.exposure.title + ' : ' + m.exposure.rangeFormatted + ' (' + m.exposure.disclaimer + ')');
    }
    lines.push('');
    lines.push('--- ' + m.ui.sectorNoteTitle + ' ---');
    lines.push(m.sector.note);
    lines.push('');
    lines.push('--- ' + m.ui.detailTitle + ' ---');
    m.categories.forEach(function (cat) {
      lines.push('');
      lines.push('[' + cat.label + ']');
      cat.checks.forEach(function (c) {
        lines.push('  (' + c.statusLabel + ') ' + c.title);
        lines.push('     ' + c.message);
      });
    });
    if (m.remediationGuide && m.remediationGuide.length) {
      lines.push('');
      lines.push('--- ' + m.ui.remediationTitle + ' ---');
      m.remediationGuide.forEach(function (item) {
        lines.push('');
        lines.push(item.rank + '. ' + item.title + ' [' + item.statusLabel + ']');
        (item.steps || []).forEach(function (s, i) { lines.push('   ' + (i + 1) + '. ' + s); });
      });
    }
    lines.push('');
    lines.push('--- ' + m.ui.methodologyTitle + ' ---');
    lines.push(m.methodology);
    lines.push(m.legal);
    lines.push('');
    lines.push(m.ui.generatedBy + ' ' + m.brand);
    return lines.join('\n');
  }

  function exportText(lang) {
    return getModelForLang(lang).then(function (m) {
      var text = buildTextReport(m);
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'cyberaudit-' + m.domain + '-' + lang + '.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  function buildHtmlReport(m) {
    var accent = /^#[0-9a-fA-F]{6}$/.test(m.accent) ? m.accent : '#F26419';
    var h = [];
    h.push('<!DOCTYPE html><html lang="' + esc(m.lang) + '"><head><meta charset="utf-8">');
    h.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    h.push('<title>' + esc(m.ui.reportTitle) + ' - ' + esc(m.domain) + '</title>');
    h.push('<style>'
      + 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1f;max-width:820px;margin:0 auto;padding:30px}'
      + 'h1{color:#fff;background:' + accent + ';padding:20px;border-radius:10px;margin:0 0 20px}'
      + 'h2{border-left:4px solid ' + accent + ';padding-left:10px;margin-top:28px}'
      + '.meta{color:#555;font-size:14px}.score{font-size:44px;font-weight:800;color:' + esc(m.gradeColor) + '}'
      + '.pill{display:inline-block;color:#fff;padding:4px 12px;border-radius:999px;font-weight:700;background:' + esc(m.gradeColor) + '}'
      + '.risk{background:#fdecec;border:1px solid #d64545;border-radius:8px;padding:16px;color:#b02a2a}'
      + '.check{border-bottom:1px solid #eee;padding:10px 0}.tag{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;color:#fff}'
      + '.fail{background:#d64545}.warn{background:#e0a410}.pass{background:#1fa971}.info{background:#8a8a93}'
      + 'ol{margin:6px 0}li{margin:4px 0}.muted{color:#666}@media print{a{display:none}}'
      + '</style></head><body>');
    h.push('<h1>' + esc(m.brand) + ' - ' + esc(m.ui.reportTitle) + '</h1>');
    h.push('<p class="meta">' + esc(m.ui.domain) + ' : <b>' + esc(m.domain) + '</b><br>'
      + esc(m.ui.sector) + ' : ' + esc(m.sector.label) + '<br>'
      + esc(m.ui.date) + ' : ' + esc(m.generatedAtLabel) + '</p>');
    h.push('<p><span class="score">' + esc(m.score) + '</span> / 100 &nbsp; <span class="pill">' + esc(m.gradeKey) + ' - ' + esc(m.gradeLabel) + '</span></p>');
    h.push('<p class="muted">' + esc(m.countsLabel.fail) + ': ' + esc(m.counts.fail) + ' | ' + esc(m.countsLabel.warn) + ': ' + esc(m.counts.warn) + ' | ' + esc(m.countsLabel.pass) + ': ' + esc(m.counts.pass) + '</p>');
    if (m.exposure) {
      h.push('<div class="risk"><b>' + esc(m.exposure.title) + '</b><br><span style="font-size:24px;font-weight:800">'
        + esc(m.exposure.hasRisk ? m.exposure.rangeFormatted : m.exposure.lowFormatted) + '</span><br><i>' + esc(m.exposure.disclaimer) + '</i></div>');
    }
    h.push('<h2>' + esc(m.ui.sectorNoteTitle) + '</h2><p>' + esc(m.sector.note) + '</p>');
    h.push('<h2>' + esc(m.ui.detailTitle) + '</h2>');
    m.categories.forEach(function (cat) {
      h.push('<h3>' + esc(cat.label) + '</h3>');
      cat.checks.forEach(function (c) {
        h.push('<div class="check"><span class="tag ' + esc(c.status) + '">' + esc(c.statusLabel) + '</span> <b>' + esc(c.title) + '</b><br>'
          + '<span class="muted">' + esc(c.message) + '</span></div>');
      });
    });
    if (m.remediationGuide && m.remediationGuide.length) {
      h.push('<h2>' + esc(m.ui.remediationTitle) + '</h2>');
      m.remediationGuide.forEach(function (item) {
        h.push('<p><b>' + esc(item.rank) + '. ' + esc(item.title) + '</b> <span class="tag ' + esc(item.status) + '">' + esc(item.statusLabel) + '</span></p>');
        h.push('<ol>' + (item.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>');
      });
    }
    h.push('<h2>' + esc(m.ui.methodologyTitle) + '</h2><p class="muted">' + esc(m.methodology) + '</p><p class="muted"><i>' + esc(m.legal) + '</i></p>');
    h.push('<p class="muted">' + esc(m.ui.generatedBy) + ' ' + esc(m.brand) + '</p>');
    h.push('</body></html>');
    return h.join('');
  }

  function exportHtml(lang) {
    return getModelForLang(lang).then(function (m) {
      var html = buildHtmlReport(m);
      var w = window.open('', '_blank');
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
      else {
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    });
  }

  // ------------------------------- Cablage -----------------------------------
  function wireApp() {
    el('runBtn').addEventListener('click', runAudit);
    el('domainInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') runAudit(); });

    // Selecteurs de langue.
    function onLang(v) {
      state.lang = v === 'en' ? 'en' : 'fr';
      save('lang', state.lang);
      applyI18n();
      populateMenus();
      relocalize();
    }
    el('langSelect').addEventListener('change', function () { onLang(this.value); });
    el('unlockLangSelect').addEventListener('change', function () { onLang(this.value); });

    // Marque blanche.
    el('brandToggle').addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      el('brandBody').hidden = expanded;
    });
    var brandTimer = null;
    el('brandNameInput').addEventListener('input', function () {
      state.brand = this.value.trim();
      save('brand', state.brand);
      applyBrand();
      clearTimeout(brandTimer);
      brandTimer = setTimeout(function () { relocalize(); }, 500);
    });
    el('accentInput').addEventListener('input', function () {
      state.accent = this.value;
      save('accent', state.accent);
      applyAccent();
    });
    el('resetBrandBtn').addEventListener('click', function () {
      state.brand = '';
      state.accent = '#F26419';
      el('brandNameInput').value = '';
      save('brand', ''); save('accent', state.accent);
      applyBrand(); applyAccent();
      relocalize();
    });

    // Changement de format d'export / options : re-rendre les boutons si resultats affiches.
    el('formatSelect').addEventListener('change', function () { if (state.lastScan) renderResults(); });
    ['sectorSelect', 'currencySelect', 'templateSelect', 'toneSelect'].forEach(function (id) {
      el(id).addEventListener('change', function () { relocalize(); });
    });
  }

  // ------------------------------- Init --------------------------------------
  function init() {
    // Restauration des preferences.
    var savedLang = load('lang'); if (savedLang) state.lang = savedLang;
    var savedBrand = load('brand'); if (savedBrand) state.brand = savedBrand;
    var savedAccent = load('accent'); if (savedAccent) state.accent = savedAccent;
    state.accessCode = load('accessCode') || '';
    state.isAdmin = load('isAdmin') === '1';

    if (state.brand) el('brandNameInput').value = state.brand;
    applyBrand();
    applyAccent();

    wireUnlock();
    wireApp();

    // Chargement config + secteurs, puis affichage.
    Promise.all([
      apiJson('/api/config').then(function (r) { return r.data; }).catch(function () { return null; }),
      apiJson('/api/sectors').then(function (r) { return r.data; }).catch(function () { return { sectors: [] }; })
    ]).then(function (arr) {
      state.config = arr[0] || {};
      state.sectors = (arr[1] && arr[1].sectors) || [];

      // Prix + lien de paiement.
      if (state.config.price) {
        var sym = state.config.currencySymbol || '$';
        var suffix = (sym === '€' || sym === 'CHF');
        el('priceAmount').textContent = suffix ? (state.config.price + ' ' + sym) : (sym + state.config.price);
      }
      if (state.config.paymentUrl) el('getAccessBtn').setAttribute('href', state.config.paymentUrl);
      else el('getAccessBtn').setAttribute('href', '#');

      applyI18n();
      populateMenus();
      el('currencySelect').value = 'EUR';

      // Verification de l'acces existant.
      if (state.accessCode) {
        tryUnlockWithKey(state.accessCode).then(function (ok) {
          if (ok) showApp(); else showUnlock();
        });
      } else {
        showUnlock();
      }
    });

    // Service worker (PWA).
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () { /* ignore */ });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
