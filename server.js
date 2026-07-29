'use strict';

/**
 * SERVEUR CyberAudit (Node.js pur, modules natifs uniquement)
 * -------------------------------------------------------------------------
 * - Sert le frontend statique (PWA) depuis /public.
 * - Expose l'API JSON d'audit, protegee par une cle d'acces (paywall).
 * - Aucune dependance de framework : uniquement http, fs, path, url + PDFKit
 *   (via le module report) pour la generation PDF.
 *
 * Variables d'environnement :
 *   PORT, HOST, DATA_DIR, SCANNER_BRAND, ACCESS_PRICE, ACCESS_CURRENCY,
 *   PAYMENT_URL, GUMROAD_PRODUCT_ID, GUMROAD_PRODUCT_PERMALINK, OWNER_KEY,
 *   ADMIN_EMAIL, ADMIN_PASSWORD.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const scanner = require('./src/scanner');
const i18n = require('./src/i18n');
const sectors = require('./src/sectors');
const access = require('./src/access');
const report = require('./src/report');
const risk = require('./src/risk');

// --- Configuration ---------------------------------------------------------

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BRAND = process.env.SCANNER_BRAND || 'CyberAudit';
const PRICE = process.env.ACCESS_PRICE || '29';
const CURRENCY = process.env.ACCESS_CURRENCY || 'USD';
const PAYMENT_URL = process.env.PAYMENT_URL || '';
const PUBLIC_DIR = path.join(__dirname, 'public');

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', CHF: 'CHF' };
function currencySymbol(code) {
  if (CURRENCY_SYMBOLS[code]) return CURRENCY_SYMBOLS[code];
  return code; // deja un symbole
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

// --- Utilitaires HTTP ------------------------------------------------------

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

/** Lit et parse un corps JSON (limite de taille). Ne rejette jamais brutalement. */
function readJsonBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve) => {
    let data = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return resolve({ error: 'too_large' });
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { resolve({ error: 'bad_json' }); }
    });
    req.on('error', () => resolve({ error: 'read_error' }));
  });
}

const MESSAGES = {
  unauthorized: { fr: "Cle d'acces invalide ou manquante.", en: 'Invalid or missing access key.' },
  invalidDomain: { fr: 'Domaine invalide. Verifiez la saisie.', en: 'Invalid domain. Please check the input.' },
  missingDomain: { fr: 'Veuillez indiquer un domaine.', en: 'Please provide a domain.' },
  serverError: { fr: 'Erreur interne, reessayez.', en: 'Internal error, please try again.' },
  missingRaw: { fr: 'Donnees de scan manquantes.', en: 'Missing scan data.' }
};
function msg(key, lang) {
  const m = MESSAGES[key] || MESSAGES.serverError;
  return lang === 'en' ? m.en : m.fr;
}

/** Verifie la cle d'acces (en-tete x-access-code). */
async function requireAccess(req) {
  const code = req.headers['x-access-code'];
  if (!code) return false;
  try { return await access.verify(String(code)); } catch (e) { return false; }
}

// --- Service des fichiers statiques ---------------------------------------

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    urlPath = '/';
  }
  if (urlPath === '/') urlPath = '/index.html';

  // Protection contre la traversee de repertoire.
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      // Repli SPA : on renvoie index.html pour les routes inconnues (hors /api).
      if (!urlPath.startsWith('/api') && path.extname(filePath) === '') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(html);
        });
        return;
      }
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Le service worker et le HTML ne doivent pas etre mis en cache trop longtemps.
    if (ext === '.html' || filePath.endsWith('sw.js')) headers['Cache-Control'] = 'no-cache';
    else if (ext === '.png' || ext === '.svg' || ext === '.ico' || ext === '.woff2') headers['Cache-Control'] = 'public, max-age=86400';
    else headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(content);
  });
}

// --- Routes API ------------------------------------------------------------

async function handleApi(req, res, urlPath) {
  const lang = 'fr'; // langue par defaut pour les messages d'erreur bas niveau

  // GET /api/config (public)
  if (req.method === 'GET' && urlPath === '/api/config') {
    return sendJson(res, 200, {
      brand: BRAND,
      price: PRICE,
      currency: CURRENCY,
      currencySymbol: currencySymbol(CURRENCY),
      paymentUrl: PAYMENT_URL,
      gumroad: Boolean(process.env.GUMROAD_PRODUCT_ID || process.env.GUMROAD_PRODUCT_PERMALINK),
      adminLogin: true
    });
  }

  // GET /api/sectors (public) : libelles FR + EN
  if (req.method === 'GET' && urlPath === '/api/sectors') {
    return sendJson(res, 200, { sectors: sectors.SECTORS.map((s) => ({ id: s.id, fr: s.fr, en: s.en })) });
  }

  // GET /api/access/status : verifie la cle de l'en-tete x-access-code
  if (req.method === 'GET' && urlPath === '/api/access/status') {
    const valid = await requireAccess(req);
    return sendJson(res, 200, { valid });
  }

  // POST /api/access/admin : connexion admin (e-mail + mot de passe)
  if (req.method === 'POST' && urlPath === '/api/access/admin') {
    const body = await readJsonBody(req);
    const result = access.adminLogin(body.email, body.password);
    if (!result.valid) {
      return sendJson(res, 401, {
        valid: false,
        message: (body.lang === 'en') ? 'Incorrect e-mail or password.' : 'E-mail ou mot de passe incorrect.'
      });
    }
    return sendJson(res, 200, { valid: true, code: result.code });
  }

  // POST /api/scan (protege) : lance l'analyse et renvoie { raw, scan }
  if (req.method === 'POST' && urlPath === '/api/scan') {
    if (!(await requireAccess(req))) return sendJson(res, 401, { error: 'unauthorized', message: msg('unauthorized', lang) });
    const body = await readJsonBody(req);
    const l = body.lang === 'en' ? 'en' : 'fr';
    if (!body.domain) return sendJson(res, 400, { error: 'missing_domain', message: msg('missingDomain', l) });
    try {
      const raw = await scanner.analyze(body.domain, { depth: body.depth });
      const scan = i18n.describe(raw, {
        lang: l,
        sector: body.sector,
        currency: body.currency,
        template: body.template,
        tone: body.tone,
        brand: body.brand,
        accent: body.accent
      });
      return sendJson(res, 200, { raw, scan });
    } catch (e) {
      if (e && e.code === 'INVALID_DOMAIN') {
        return sendJson(res, 400, { error: 'invalid_domain', message: msg('invalidDomain', l) });
      }
      return sendJson(res, 500, { error: 'scan_failed', message: msg('serverError', l) });
    }
  }

  // POST /api/localize (protege) : re-traduit un scan brut SANS re-scanner
  if (req.method === 'POST' && urlPath === '/api/localize') {
    if (!(await requireAccess(req))) return sendJson(res, 401, { error: 'unauthorized', message: msg('unauthorized', lang) });
    const body = await readJsonBody(req);
    const l = body.lang === 'en' ? 'en' : 'fr';
    if (!body.raw || !Array.isArray(body.raw.checks)) return sendJson(res, 400, { error: 'missing_raw', message: msg('missingRaw', l) });
    try {
      const scan = i18n.describe(body.raw, {
        lang: l,
        sector: body.sector,
        currency: body.currency,
        template: body.template,
        tone: body.tone,
        brand: body.brand,
        accent: body.accent
      });
      return sendJson(res, 200, { scan });
    } catch (e) {
      return sendJson(res, 500, { error: 'localize_failed', message: msg('serverError', l) });
    }
  }

  // POST /api/report (protege) : genere le PDF a partir du brut
  if (req.method === 'POST' && urlPath === '/api/report') {
    if (!(await requireAccess(req))) return sendJson(res, 401, { error: 'unauthorized', message: msg('unauthorized', lang) });
    const body = await readJsonBody(req);
    const l = body.lang === 'en' ? 'en' : 'fr';
    if (!body.raw || !Array.isArray(body.raw.checks)) return sendJson(res, 400, { error: 'missing_raw', message: msg('missingRaw', l) });
    try {
      const model = i18n.describe(body.raw, {
        lang: l,
        sector: body.sector,
        currency: body.currency,
        template: body.template,
        tone: body.tone,
        brand: body.brand,
        accent: body.accent
      });
      const domainSafe = String(model.domain || 'rapport').replace(/[^a-z0-9.-]/gi, '_');
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cyberaudit-${domainSafe}-${l}.pdf"`,
        'Cache-Control': 'no-store'
      });
      report.build(model, res); // pipe le PDF directement dans la reponse
      return undefined;
    } catch (e) {
      return sendJson(res, 500, { error: 'report_failed', message: msg('serverError', l) });
    }
  }

  // Sante (pour Docker / reverse proxy)
  if (req.method === 'GET' && (urlPath === '/api/health' || urlPath === '/healthz')) {
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'not_found' });
}

// --- Serveur ---------------------------------------------------------------

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    res.writeHead(400); res.end('Bad request'); return;
  }

  if (urlPath.startsWith('/api/') || urlPath === '/healthz') {
    handleApi(req, res, urlPath).catch(() => {
      if (!res.headersSent) sendJson(res, 500, { error: 'server_error' });
      else try { res.end(); } catch (e) { /* ignore */ }
    });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res);
  }
  res.writeHead(405); res.end('Method not allowed');
});

// Initialise le magasin de cles (genere la cle proprietaire au 1er lancement).
const store = access.ensureStore();

server.listen(PORT, HOST, () => {
  /* eslint-disable no-console */
  console.log('====================================================');
  console.log(`  ${BRAND} - scanner de securite (non intrusif)`);
  console.log('====================================================');
  console.log(`  URL          : http://${HOST}:${PORT}`);
  console.log(`  Dossier data : ${access.DATA_DIR}`);
  console.log(`  Cle proprietaire (OWNER_KEY) : ${store.ownerKey}`);
  console.log(`  Compte admin : ${access.getAdminEmail()}`);
  console.log('  (mot de passe admin = ADMIN_PASSWORD ou, a defaut, la cle proprietaire)');
  console.log('====================================================');
  /* eslint-enable no-console */
});

module.exports = server;
