'use strict';

/**
 * Module SCANNER (analyse reseau -> resultat BRUT neutre)
 * -------------------------------------------------------------------------
 * Ce module ne fait QUE des observations passives et non intrusives :
 *   - une poignee de main TLS (port 443) pour recuperer le certificat ;
 *   - des requetes HTTP/HTTPS pour lire les en-tetes publics ;
 *   - des resolutions DNS publiques (TXT, MX, CAA).
 * Aucune tentative d'exploitation, aucune injection, aucun scan de ports
 * agressif : uniquement des informations deja publiques.
 *
 * Le resultat produit est "brut" et NEUTRE (independant de la langue) : chaque
 * controle expose un identifiant, une categorie, un statut, un poids et une
 * "evidence" (preuve technique = valeurs brutes). La mise en forme dans une
 * langue est faite ailleurs (module i18n / fonction describe).
 *
 * Robustesse : chaque sonde a un timeout et est protegee. Un domaine
 * injoignable ne fait jamais planter l'analyse : il produit des constats
 * "a corriger".
 */

const tls = require('tls');
const http = require('http');
const https = require('https');
const dns = require('dns').promises;

// --- Constantes de configuration -----------------------------------------

const TLS_TIMEOUT = 8000;
const HTTP_TIMEOUT = 8000;
const DNS_TIMEOUT = 6000;
const MAX_REDIRECTS = 5;

// Statuts possibles d'un controle.
const STATUS = { PASS: 'pass', WARN: 'warn', FAIL: 'fail', INFO: 'info' };

/**
 * Definition de tous les controles : ordre d'affichage, categorie, poids
 * (importance dans le score) et niveau de profondeur minimal.
 *   depth 1 = Rapide, 2 = Standard, 3 = Approfondi.
 * Un controle est retenu si son niveau est <= a la profondeur demandee.
 */
const CHECK_DEFS = [
  // 1) Chiffrement (SSL/TLS)
  { id: 'https_available', category: 'encryption', weight: 12, depth: 1 },
  { id: 'cert_valid', category: 'encryption', weight: 12, depth: 1 },
  { id: 'cert_expiry', category: 'encryption', weight: 8, depth: 1 },
  { id: 'http_redirect', category: 'encryption', weight: 6, depth: 2 },
  // 2) En-tetes de securite HTTP
  { id: 'hsts', category: 'headers', weight: 7, depth: 1 },
  { id: 'csp', category: 'headers', weight: 7, depth: 2 },
  { id: 'clickjacking', category: 'headers', weight: 6, depth: 2 },
  { id: 'xcto', category: 'headers', weight: 4, depth: 2 },
  { id: 'referrer_policy', category: 'headers', weight: 3, depth: 3 },
  { id: 'permissions_policy', category: 'headers', weight: 3, depth: 3 },
  // 3) Securite e-mail (anti-usurpation)
  { id: 'spf', category: 'email', weight: 8, depth: 1 },
  { id: 'dmarc', category: 'email', weight: 8, depth: 1 },
  { id: 'dmarc_policy', category: 'email', weight: 5, depth: 2 },
  { id: 'mx', category: 'email', weight: 2, depth: 2 },
  // 4) Divulgation d'information
  { id: 'server_header', category: 'disclosure', weight: 3, depth: 2 },
  { id: 'xpb', category: 'disclosure', weight: 3, depth: 2 },
  { id: 'cookies', category: 'disclosure', weight: 4, depth: 3 },
  // 5) DNS / Infrastructure
  { id: 'caa', category: 'dns', weight: 2, depth: 3 }
];

const DEPTH_LEVEL = { quick: 1, standard: 2, deep: 3 };

// --- Normalisation du domaine ---------------------------------------------

/**
 * Normalise une saisie utilisateur en un nom d'hote propre :
 * retire le schema (http://...), le chemin, la query, le fragment, le port
 * et le point final. Ne retire PAS le www ici (voir apexForDns).
 */
function normalizeDomain(input) {
  let s = String(input || '').trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // schema
  s = s.split('/')[0].split('?')[0].split('#')[0]; // chemin / query / fragment
  s = s.replace(/:\d+$/, ''); // port
  s = s.replace(/\.+$/, ''); // point(s) final(aux)
  return s;
}

/** Retire le prefixe www pour les resolutions DNS (SPF/DMARC/MX/CAA). */
function apexForDns(host) {
  return host.replace(/^www\./, '');
}

/** Verifie qu'un hote ressemble a un nom de domaine valide. */
function isValidDomain(host) {
  if (!host || host.length > 253) return false;
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);
}

// --- Utilitaires reseau ----------------------------------------------------

/** Course entre une promesse et un timeout renvoyant une valeur de repli. */
function withTimeout(promise, ms, fallback) {
  let timer;
  const t = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise.then((v) => { clearTimeout(timer); return v; }), t]);
}

/**
 * Poignee de main TLS sur le port 443. Recupere le certificat, indique si le
 * certificat est reconnu (autorise) et pourquoi il ne le serait pas.
 * Ne rejette jamais : renvoie { reachable:false, ... } en cas d'echec.
 */
function probeTls(host, port = 443, timeout = TLS_TIMEOUT) {
  return new Promise((resolve) => {
    let done = false;
    let socket;
    const finish = (value) => {
      if (done) return;
      done = true;
      try { if (socket) socket.destroy(); } catch (e) { /* ignore */ }
      resolve(value);
    };
    try {
      socket = tls.connect(
        { host, port, servername: host, rejectUnauthorized: false, ALPNProtocols: ['http/1.1'] },
        () => {
          const cert = socket.getPeerCertificate(true) || {};
          finish({
            reachable: true,
            host,
            authorized: !!socket.authorized,
            authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
            protocol: socket.getProtocol ? socket.getProtocol() : null,
            cert: {
              subject: cert.subject || null,
              issuer: cert.issuer || null,
              valid_from: cert.valid_from || null,
              valid_to: cert.valid_to || null,
              subjectaltname: cert.subjectaltname || null
            }
          });
        }
      );
      socket.setTimeout(timeout, () => finish({ reachable: false, host, error: 'timeout' }));
      socket.on('error', (e) => finish({ reachable: false, host, error: (e && (e.code || e.message)) || 'error' }));
    } catch (e) {
      finish({ reachable: false, host, error: (e && e.message) || 'error' });
    }
  });
}

/**
 * Effectue UNE requete HTTP(S) et renvoie le statut + les en-tetes de la
 * PREMIERE reponse (sans suivre les redirections). Ne rejette jamais.
 */
function requestOnce(urlString, { timeout = HTTP_TIMEOUT, method = 'GET' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    let req;
    const finish = (value) => {
      if (done) return;
      done = true;
      try { if (req) req.destroy(); } catch (e) { /* ignore */ }
      resolve(value);
    };
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      return finish({ reachable: false, error: 'bad_url' });
    }
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      servername: url.hostname,
      rejectUnauthorized: false, // on veut lire les en-tetes meme si le cert est invalide
      headers: {
        'User-Agent': 'CyberAudit/1.0 (+non-intrusive security scanner)',
        Accept: '*/*',
        Connection: 'close'
      }
    };
    try {
      req = lib.request(options, (res) => {
        finish({
          reachable: true,
          status: res.statusCode,
          headers: res.headers || {},
          setCookie: res.headers && res.headers['set-cookie'] ? res.headers['set-cookie'] : [],
          location: res.headers && res.headers.location ? res.headers.location : null
        });
        // On n'a pas besoin du corps : on coupe la connexion proprement.
        res.on('error', () => {});
        try { res.destroy(); } catch (e) { /* ignore */ }
      });
      req.setTimeout(timeout, () => finish({ reachable: false, error: 'timeout' }));
      req.on('error', (e) => finish({ reachable: false, error: (e && (e.code || e.message)) || 'error' }));
      req.end();
    } catch (e) {
      finish({ reachable: false, error: (e && e.message) || 'error' });
    }
  });
}

/**
 * Recupere les en-tetes FINAUX en suivant les redirections (jusqu'a
 * MAX_REDIRECTS). Utilise pour analyser les en-tetes de securite du site.
 */
async function fetchFinalHeaders(startUrl) {
  let current = startUrl;
  let last = { reachable: false };
  let redirectedToHttps = false;
  const startedHttp = current.startsWith('http://');
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const res = await requestOnce(current);
    last = res;
    if (!res.reachable) break;
    const status = res.status || 0;
    if (status >= 300 && status < 400 && res.location) {
      let next;
      try {
        next = new URL(res.location, current).toString();
      } catch (e) {
        break;
      }
      if (startedHttp && next.startsWith('https://')) redirectedToHttps = true;
      current = next;
      continue;
    }
    break;
  }
  return { ...last, finalUrl: current, redirectedToHttps };
}

/** Resolutions DNS protegees (ne rejettent jamais, renvoient un objet). */
async function dnsTxt(name) {
  try {
    const records = await withTimeout(dns.resolveTxt(name), DNS_TIMEOUT, null);
    if (!records) return { ok: false, error: 'timeout', records: [] };
    return { ok: true, records: records.map((chunks) => chunks.join('')) };
  } catch (e) {
    return { ok: false, error: (e && e.code) || 'error', records: [] };
  }
}

async function dnsMx(name) {
  try {
    const records = await withTimeout(dns.resolveMx(name), DNS_TIMEOUT, null);
    if (!records) return { ok: false, error: 'timeout', records: [] };
    return { ok: true, records };
  } catch (e) {
    return { ok: false, error: (e && e.code) || 'error', records: [] };
  }
}

async function dnsCaa(name) {
  try {
    const records = await withTimeout(dns.resolveCaa(name), DNS_TIMEOUT, null);
    if (!records) return { ok: false, error: 'timeout', records: [] };
    return { ok: true, records };
  } catch (e) {
    return { ok: false, error: (e && e.code) || 'error', records: [] };
  }
}

// --- Construction des controls a partir des sondes ------------------------

/** Parse une date de certificat (format OpenSSL) en objet Date ou null. */
function parseCertDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Construit la table de tous les controles (id -> {status, evidence}) a partir
 * des resultats des sondes. Chaque controle est protege : en cas d'absence de
 * donnee, on tombe sur un constat "a corriger" (jamais d'exception).
 */
function buildChecks(ctx) {
  const { tls: t, httpsHead, httpRedirect, spf, dmarc, mx, caa } = ctx;
  const headers = (httpsHead && httpsHead.reachable && httpsHead.headers) || null;
  const out = {};

  // Helper de recuperation d'en-tete (insensible a la casse : Node minuscule deja).
  const h = (name) => (headers ? headers[name] : undefined);

  // 1) HTTPS disponible
  out.https_available = t.reachable
    ? { status: STATUS.PASS, evidence: { reachable: true, host: t.host, protocol: t.protocol || null } }
    : { status: STATUS.FAIL, evidence: { reachable: false, error: t.error || 'unreachable' } };

  // 2) Certificat valide et reconnu
  if (!t.reachable) {
    out.cert_valid = { status: STATUS.FAIL, evidence: { reachable: false } };
  } else if (t.authorized) {
    out.cert_valid = {
      status: STATUS.PASS,
      evidence: { authorized: true, issuer: (t.cert.issuer && (t.cert.issuer.O || t.cert.issuer.CN)) || null }
    };
  } else {
    out.cert_valid = {
      status: STATUS.FAIL,
      evidence: { authorized: false, reason: t.authorizationError || 'unauthorized' }
    };
  }

  // 3) Date d'expiration du certificat
  if (!t.reachable || !t.cert.valid_to) {
    out.cert_expiry = { status: STATUS.FAIL, evidence: { available: false } };
  } else {
    const to = parseCertDate(t.cert.valid_to);
    const from = parseCertDate(t.cert.valid_from);
    const now = new Date();
    const daysLeft = to ? Math.floor((to.getTime() - now.getTime()) / 86400000) : null;
    let status = STATUS.PASS;
    if (from && from.getTime() > now.getTime()) status = STATUS.FAIL; // pas encore valide
    else if (daysLeft === null || daysLeft < 0) status = STATUS.FAIL; // expire
    else if (daysLeft < 21) status = STATUS.WARN; // expiration proche
    out.cert_expiry = {
      status,
      evidence: {
        validFrom: t.cert.valid_from || null,
        validTo: t.cert.valid_to || null,
        daysLeft
      }
    };
  }

  // 4) Redirection HTTP -> HTTPS
  if (!t.reachable) {
    out.http_redirect = { status: STATUS.FAIL, evidence: { httpsAvailable: false } };
  } else if (httpRedirect && httpRedirect.reachable) {
    const st = httpRedirect.status || 0;
    const loc = httpRedirect.location || '';
    if (st >= 300 && st < 400 && /^https:\/\//i.test(loc)) {
      out.http_redirect = { status: STATUS.PASS, evidence: { statusCode: st, location: loc } };
    } else if (st >= 300 && st < 400) {
      out.http_redirect = { status: STATUS.WARN, evidence: { statusCode: st, location: loc || null } };
    } else {
      out.http_redirect = { status: STATUS.FAIL, evidence: { statusCode: st, servedPlainHttp: true } };
    }
  } else {
    // Aucun service sur le port 80 : pas d'exposition en clair.
    out.http_redirect = { status: STATUS.PASS, evidence: { port80: 'closed' } };
  }

  // 5) HSTS
  if (!headers) {
    out.hsts = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('strict-transport-security');
    if (v) {
      const m = /max-age=(\d+)/i.exec(v);
      const maxAge = m ? parseInt(m[1], 10) : 0;
      if (maxAge >= 15768000) out.hsts = { status: STATUS.PASS, evidence: { value: v, maxAge } };
      else out.hsts = { status: STATUS.WARN, evidence: { value: v, maxAge } };
    } else {
      out.hsts = { status: STATUS.WARN, evidence: { present: false } };
    }
  }

  // 6) Content-Security-Policy
  if (!headers) {
    out.csp = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('content-security-policy');
    const ro = h('content-security-policy-report-only');
    if (v) out.csp = { status: STATUS.PASS, evidence: { present: true } };
    else if (ro) out.csp = { status: STATUS.WARN, evidence: { reportOnly: true } };
    else out.csp = { status: STATUS.WARN, evidence: { present: false } };
  }

  // 7) Anti-clickjacking (X-Frame-Options ou CSP frame-ancestors)
  if (!headers) {
    out.clickjacking = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const xfo = h('x-frame-options');
    const csp = h('content-security-policy') || '';
    if (xfo || /frame-ancestors/i.test(csp)) {
      out.clickjacking = { status: STATUS.PASS, evidence: { xFrameOptions: xfo || null, frameAncestors: /frame-ancestors/i.test(csp) } };
    } else {
      out.clickjacking = { status: STATUS.FAIL, evidence: { present: false } };
    }
  }

  // 8) X-Content-Type-Options (nosniff)
  if (!headers) {
    out.xcto = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('x-content-type-options');
    if (v && /nosniff/i.test(v)) out.xcto = { status: STATUS.PASS, evidence: { value: v } };
    else if (v) out.xcto = { status: STATUS.WARN, evidence: { value: v } };
    else out.xcto = { status: STATUS.FAIL, evidence: { present: false } };
  }

  // 9) Referrer-Policy
  if (!headers) {
    out.referrer_policy = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('referrer-policy');
    out.referrer_policy = v
      ? { status: STATUS.PASS, evidence: { value: v } }
      : { status: STATUS.WARN, evidence: { present: false } };
  }

  // 10) Permissions-Policy (ou l'ancien Feature-Policy)
  if (!headers) {
    out.permissions_policy = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('permissions-policy') || h('feature-policy');
    out.permissions_policy = v
      ? { status: STATUS.PASS, evidence: { value: v } }
      : { status: STATUS.WARN, evidence: { present: false } };
  }

  // 11) SPF
  if (!spf.ok) {
    out.spf = { status: STATUS.FAIL, evidence: { found: false, error: spf.error || null } };
  } else {
    const spfRecords = spf.records.filter((r) => /^v=spf1/i.test(r.trim()));
    if (spfRecords.length === 1) out.spf = { status: STATUS.PASS, evidence: { record: spfRecords[0] } };
    else if (spfRecords.length > 1) out.spf = { status: STATUS.WARN, evidence: { records: spfRecords, multiple: true } };
    else out.spf = { status: STATUS.FAIL, evidence: { found: false } };
  }

  // 12) DMARC + 13) Politique DMARC
  let dmarcRecord = null;
  if (dmarc.ok) dmarcRecord = dmarc.records.find((r) => /^v=DMARC1/i.test(r.trim())) || null;
  if (dmarcRecord) out.dmarc = { status: STATUS.PASS, evidence: { record: dmarcRecord } };
  else out.dmarc = { status: STATUS.FAIL, evidence: { found: false, error: dmarc.ok ? null : dmarc.error } };

  if (!dmarcRecord) {
    out.dmarc_policy = { status: STATUS.FAIL, evidence: { policy: null } };
  } else {
    const pm = /(?:^|;)\s*p\s*=\s*(none|quarantine|reject)/i.exec(dmarcRecord);
    const policy = pm ? pm[1].toLowerCase() : 'none';
    if (policy === 'reject') out.dmarc_policy = { status: STATUS.PASS, evidence: { policy } };
    else if (policy === 'quarantine') out.dmarc_policy = { status: STATUS.WARN, evidence: { policy } };
    else out.dmarc_policy = { status: STATUS.FAIL, evidence: { policy } };
  }

  // 14) Serveurs MX (informatif)
  if (mx.ok && mx.records.length) {
    out.mx = {
      status: STATUS.INFO,
      evidence: { servers: mx.records.map((r) => r.exchange).slice(0, 8), count: mx.records.length }
    };
  } else {
    out.mx = { status: STATUS.INFO, evidence: { servers: [], count: 0 } };
  }

  // 15) En-tete Server (version divulguee ?)
  if (!headers) {
    out.server_header = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('server');
    if (!v) out.server_header = { status: STATUS.PASS, evidence: { present: false } };
    else if (/\d/.test(v)) out.server_header = { status: STATUS.WARN, evidence: { value: v, disclosesVersion: true } };
    else out.server_header = { status: STATUS.INFO, evidence: { value: v, disclosesVersion: false } };
  }

  // 16) X-Powered-By
  if (!headers) {
    out.xpb = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const v = h('x-powered-by');
    out.xpb = v
      ? { status: STATUS.WARN, evidence: { value: v } }
      : { status: STATUS.PASS, evidence: { present: false } };
  }

  // 17) Cookies Secure / HttpOnly
  if (!headers) {
    out.cookies = { status: STATUS.FAIL, evidence: { headersAvailable: false } };
  } else {
    const cookies = httpsHead.setCookie || [];
    if (!cookies.length) {
      out.cookies = { status: STATUS.INFO, evidence: { count: 0 } };
    } else {
      const details = cookies.map((c) => {
        const name = String(c).split('=')[0].trim();
        return { name, secure: /;\s*secure/i.test(c), httpOnly: /;\s*httponly/i.test(c) };
      });
      const missingSecure = details.some((d) => !d.secure);
      const missingHttpOnly = details.some((d) => !d.httpOnly);
      let status = STATUS.PASS;
      if (missingSecure) status = STATUS.FAIL;
      else if (missingHttpOnly) status = STATUS.WARN;
      out.cookies = { status, evidence: { count: details.length, cookies: details.slice(0, 8) } };
    }
  }

  // 18) Enregistrement CAA
  if (caa.ok && caa.records.length) {
    const issuers = caa.records
      .map((r) => r.issue || r.issuewild || r.iodef)
      .filter(Boolean);
    out.caa = { status: STATUS.PASS, evidence: { issuers } };
  } else {
    out.caa = { status: STATUS.WARN, evidence: { present: false } };
  }

  return out;
}

// --- Score et note ---------------------------------------------------------

const STATUS_FRACTION = { pass: 1, warn: 0.5, fail: 0, info: null };

/** Calcule le score /100 et la note lettre a partir des controles retenus. */
function computeScore(checks) {
  let got = 0;
  let max = 0;
  const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const c of checks) {
    counts[c.status] += 1;
    const frac = STATUS_FRACTION[c.status];
    if (frac === null) continue; // les controles "info" ne comptent pas
    max += c.weight;
    got += c.weight * frac;
  }
  const score = max > 0 ? Math.round((got / max) * 100) : 0;
  let gradeKey = 'E';
  if (score >= 90) gradeKey = 'A';
  else if (score >= 75) gradeKey = 'B';
  else if (score >= 60) gradeKey = 'C';
  else if (score >= 40) gradeKey = 'D';
  return { score, gradeKey, counts };
}

// --- Fonction principale : analyze ----------------------------------------

/**
 * Lance l'analyse reseau non intrusive d'un domaine et renvoie un resultat
 * BRUT neutre (independant de la langue). Options : { depth } parmi
 * 'quick' | 'standard' | 'deep' (defaut 'standard').
 */
async function analyze(domain, options = {}) {
  const host = normalizeDomain(domain);
  if (!isValidDomain(host)) {
    const err = new Error('invalid_domain');
    err.code = 'INVALID_DOMAIN';
    throw err;
  }
  const apex = apexForDns(host);
  const depth = DEPTH_LEVEL[options.depth] ? options.depth : 'standard';
  const maxLevel = DEPTH_LEVEL[depth];

  // Les resolutions DNS ne dependent pas de l'hote web : on les lance tout de suite.
  const dnsPromise = Promise.all([
    dnsTxt(apex),
    dnsTxt(`_dmarc.${apex}`),
    dnsMx(apex),
    dnsCaa(apex)
  ]);

  // Decouverte de l'hote web joignable : l'hote saisi, puis bascule www.
  const candidates = host.startsWith('www.') ? [host, apex] : [host, `www.${host}`];
  let tlsResult = { reachable: false, host };
  for (const cand of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const r = await probeTls(cand);
    tlsResult = r;
    if (r.reachable) break;
  }
  const webHost = tlsResult.reachable ? tlsResult.host : host;

  // Requetes HTTP en parallele (en-tetes finaux HTTPS + test de redirection 80).
  const [httpsHead, httpRedirect] = await Promise.all([
    fetchFinalHeaders(`https://${webHost}/`),
    requestOnce(`http://${webHost}/`, { timeout: HTTP_TIMEOUT })
  ]);

  const [spf, dmarc, mx, caa] = await dnsPromise;

  const table = buildChecks({ tls: tlsResult, httpsHead, httpRedirect, spf, dmarc, mx, caa });

  // Assemble la liste des controles retenus selon la profondeur, dans l'ordre.
  const checks = CHECK_DEFS.filter((d) => d.depth <= maxLevel).map((d) => ({
    id: d.id,
    category: d.category,
    weight: d.weight,
    depth: d.depth,
    status: table[d.id] ? table[d.id].status : STATUS.FAIL,
    evidence: table[d.id] ? table[d.id].evidence : {}
  }));

  const { score, gradeKey, counts } = computeScore(checks);

  return {
    version: 1,
    domain: apex,
    host,
    webHost,
    depth,
    scannedAt: new Date().toISOString(),
    reachable: tlsResult.reachable || (httpsHead && httpsHead.reachable) || false,
    score,
    gradeKey,
    counts,
    checks,
    meta: {
      tlsReachable: tlsResult.reachable,
      tlsError: tlsResult.error || null,
      httpsHeadersReachable: !!(httpsHead && httpsHead.reachable),
      redirectedToHttps: !!(httpsHead && httpsHead.redirectedToHttps)
    }
  };
}

module.exports = {
  analyze,
  normalizeDomain,
  apexForDns,
  isValidDomain,
  computeScore,
  CHECK_DEFS,
  STATUS,
  DEPTH_LEVEL
};
