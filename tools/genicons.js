#!/usr/bin/env node
'use strict';

/**
 * Generateur d'icones PWA (PNG) en Node pur, sans dependance.
 * -------------------------------------------------------------------------
 * Dessine un bouclier orange sur fond sombre avec une serrure, puis encode
 * un vrai fichier PNG (RGBA, 8 bits) via zlib. Produit les icones 192/512,
 * une version "maskable", l'icone Apple (180) et un favicon (32).
 *
 * Lancement : node tools/genicons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// --- Encodeur PNG minimal --------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- Dessin ----------------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const BG = hexToRgb('#0D0D0F');
const ACCENT = hexToRgb('#F26419');
const DARK = hexToRgb('#0D0D0F');

/** Teste si un point (nx,ny) dans [-1,1] appartient au bouclier. */
function inShield(nx, ny) {
  if (ny < -1 || ny > 1) return false;
  let hw;
  if (ny <= 0.15) {
    hw = 0.82;
    if (ny < -0.72) {
      const k = (ny + 0.72) / 0.28; // 0 a -0.72, -1 a -1
      const s = 1 - k * k; // dome arrondi en haut
      hw = 0.82 * Math.sqrt(Math.max(0, s));
    }
  } else {
    const t = (ny - 0.15) / 0.85; // 0..1 vers la pointe
    hw = 0.82 * Math.pow(Math.max(0, 1 - t), 0.85);
  }
  return Math.abs(nx) <= hw;
}

/** Teste si (nx,ny) appartient a la serrure (cercle + tige). */
function inKeyhole(nx, ny) {
  const cyC = -0.12;
  const r = 0.2;
  if ((nx * nx + (ny - cyC) * (ny - cyC)) <= r * r) return true;
  // tige triangulaire qui s'elargit vers le bas
  const top = cyC;
  const bottom = 0.4;
  if (ny >= top && ny <= bottom) {
    const t = (ny - top) / (bottom - top);
    const halfW = 0.06 + 0.14 * t;
    if (Math.abs(nx) <= halfW) return true;
  }
  return false;
}

/**
 * Genere une icone.
 * @param {number} size taille en pixels
 * @param {number} scale echelle du bouclier (1 = plein, <1 = marge maskable)
 * @param {boolean} opaque fond opaque (Apple) ou transparent hors bouclier
 */
function drawIcon(size, scale = 0.86, opaque = false) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const half = (size / 2) * scale;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      const nx = (x - cx) / half;
      const ny = (y - cy) / half;
      let r; let g; let b; let a = 255;
      if (inShield(nx, ny)) {
        if (inKeyhole(nx, ny)) { [r, g, b] = DARK; } else { [r, g, b] = ACCENT; }
      } else if (opaque) {
        [r, g, b] = BG;
      } else {
        // Fond sombre arrondi (carre plein sombre) pour un rendu net sur toutes plateformes.
        [r, g, b] = BG;
      }
      buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = a;
    }
  }
  return encodePng(size, size, buf);
}

// --- Ecriture --------------------------------------------------------------

function write(name, data) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, data);
  console.log(`ecrit : ${p} (${data.length} octets)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
write('icon-192.png', drawIcon(192, 0.86, true));
write('icon-512.png', drawIcon(512, 0.86, true));
write('maskable-512.png', drawIcon(512, 0.62, true)); // marge pour la zone de securite
write('apple-touch-icon.png', drawIcon(180, 0.82, true));
write('favicon-32.png', drawIcon(32, 0.9, true));
console.log('Icones generees.');
