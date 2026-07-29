'use strict';

/**
 * Module ACCESS (paywall + cles d'acces + compte admin)
 * -------------------------------------------------------------------------
 * L'application est verrouillee derriere une cle d'acces. Ce module gere :
 *   - la cle PROPRIETAIRE, generee au 1er lancement et persistee ;
 *   - les cles VENDABLES (ajout/liste/revocation via manage.js) ;
 *   - la verification d'une cle (en-tete x-access-code) ;
 *   - la verification optionnelle d'une licence GUMROAD (livraison auto) ;
 *   - la connexion ADMIN (e-mail + mot de passe) donnant un acces total gratuit.
 *
 * Persistance : fichier JSON dans DATA_DIR (volume Docker), avec ecriture
 * ATOMIQUE (fichier temporaire puis renommage) et relecture a chaque appel
 * pour rester coherent entre processus (serveur + manage.js).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'access.json');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'kplaaka@gmail.com').trim().toLowerCase();

// --- Utilitaires de generation de cle -------------------------------------

/** Genere une cle d'acces lisible du type CYBER-XXXX-XXXX-XXXX. */
function generateKey(prefix = 'CYBER') {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans I, L, O, 0, 1 (lisibilite)
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i !== 11) out += '-';
  }
  return `${prefix}-${out}`;
}

// --- Persistance -----------------------------------------------------------

function ensureDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}

/** Ecriture atomique : ecrit un fichier temporaire puis le renomme. */
function writeStore(store) {
  ensureDir();
  const tmp = `${STORE_PATH}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STORE_PATH);
}

/** Lit le magasin depuis le disque (relecture fraiche a chaque appel). */
function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.keys) parsed.keys = {};
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Garantit l'existence du magasin et de la cle proprietaire. Genere la cle
 * proprietaire au 1er lancement (depuis OWNER_KEY si fournie, sinon aleatoire).
 */
function ensureStore() {
  let store = readStore();
  if (!store) {
    store = { ownerKey: (process.env.OWNER_KEY || generateKey('OWNER')).trim(), keys: {}, createdAt: new Date().toISOString() };
    writeStore(store);
    return store;
  }
  // Si OWNER_KEY est impose par l'environnement, il prime.
  if (process.env.OWNER_KEY && store.ownerKey !== process.env.OWNER_KEY.trim()) {
    store.ownerKey = process.env.OWNER_KEY.trim();
    writeStore(store);
  }
  return store;
}

function getOwnerKey() {
  return ensureStore().ownerKey;
}

/** Mot de passe admin : ADMIN_PASSWORD si defini, sinon la cle proprietaire. */
function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()) || getOwnerKey();
}

// --- Gestion des cles (utilisee par manage.js) -----------------------------

function addKey(label) {
  const store = ensureStore();
  const code = generateKey('CYBER');
  store.keys[code] = {
    label: label || '',
    createdAt: new Date().toISOString(),
    revoked: false,
    source: 'manual'
  };
  writeStore(store);
  return code;
}

function listKeys() {
  const store = ensureStore();
  return Object.keys(store.keys).map((code) => ({ code, ...store.keys[code] }));
}

function revokeKey(code) {
  const store = ensureStore();
  if (!store.keys[code]) return false;
  store.keys[code].revoked = true;
  store.keys[code].revokedAt = new Date().toISOString();
  writeStore(store);
  return true;
}

// --- Verification d'une cle -----------------------------------------------

/** Verification locale (cle proprietaire ou cle vendable non revoquee). */
function isValidLocal(code) {
  if (!code) return false;
  const store = ensureStore();
  if (code === store.ownerKey) return true;
  const entry = store.keys[code];
  return Boolean(entry && !entry.revoked);
}

/**
 * Verification d'une licence Gumroad (optionnelle). Ne rejette jamais :
 * renvoie true si la licence est valide et non remboursee, false sinon.
 */
function verifyGumroad(licenseKey) {
  const productId = process.env.GUMROAD_PRODUCT_ID;
  const permalink = process.env.GUMROAD_PRODUCT_PERMALINK;
  if (!licenseKey || (!productId && !permalink)) return Promise.resolve(false);

  const params = new URLSearchParams();
  if (productId) params.append('product_id', productId);
  if (permalink) params.append('product_permalink', permalink);
  params.append('license_key', licenseKey);
  params.append('increment_uses_count', 'false');
  const body = params.toString();

  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const req = https.request(
        {
          method: 'POST',
          hostname: 'api.gumroad.com',
          path: '/v2/licenses/verify',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const purchase = json && json.purchase;
              const ok = Boolean(json && json.success && purchase
                && !purchase.refunded && !purchase.chargebacked && !purchase.disputed);
              finish(ok);
            } catch (e) {
              finish(false);
            }
          });
        }
      );
      req.setTimeout(8000, () => finish(false));
      req.on('error', () => finish(false));
      req.write(body);
      req.end();
    } catch (e) {
      finish(false);
    }
  });
}

/**
 * Verifie une cle d'acces : d'abord localement, puis via Gumroad si configure.
 * Si la licence Gumroad est valide, la cle est enregistree pour les prochaines
 * verifications (livraison automatique).
 * @returns {Promise<boolean>}
 */
async function verify(code) {
  if (isValidLocal(code)) return true;
  const gumroadOk = await verifyGumroad(code);
  if (gumroadOk) {
    const store = ensureStore();
    if (!store.keys[code]) {
      store.keys[code] = { label: 'Gumroad', createdAt: new Date().toISOString(), revoked: false, source: 'gumroad' };
      writeStore(store);
    }
    return true;
  }
  return false;
}

// --- Connexion admin -------------------------------------------------------

/** Comparaison de chaines resistante au timing (longueurs identiques requises). */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); } catch (e) { return false; }
}

/**
 * Connexion admin : e-mail (insensible a la casse) + mot de passe OBLIGATOIRE.
 * L'e-mail seul ne suffit jamais. En cas de succes, renvoie la cle d'acces
 * (cle proprietaire) a utiliser dans l'en-tete x-access-code.
 * @returns {{ valid:boolean, code?:string }}
 */
function adminLogin(email, password) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  if (!e || !p) return { valid: false };
  if (e !== ADMIN_EMAIL) return { valid: false };
  if (!safeEqual(p, getAdminPassword())) return { valid: false };
  return { valid: true, code: getOwnerKey() };
}

function getAdminEmail() {
  return ADMIN_EMAIL;
}

module.exports = {
  DATA_DIR,
  STORE_PATH,
  generateKey,
  ensureStore,
  getOwnerKey,
  getAdminPassword,
  getAdminEmail,
  addKey,
  listKeys,
  revokeKey,
  isValidLocal,
  verify,
  verifyGumroad,
  adminLogin
};
