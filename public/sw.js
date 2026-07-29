'use strict';

/**
 * Service Worker CyberAudit (PWA)
 * -------------------------------------------------------------------------
 * - Met en cache la "coquille" (shell) de l'application pour un chargement
 *   instantane et un fonctionnement hors-ligne de l'interface.
 * - NE MET JAMAIS en cache les routes /api/* (donnees dynamiques / audit).
 */

const CACHE = 'cyberaudit-shell-v1';
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Jamais de cache sur l'API : on laisse le reseau gerer.
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Autres domaines : on ne gere pas.
  if (url.origin !== self.location.origin) return;

  // Navigation : renvoyer la coquille si hors-ligne.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Ressources du shell : cache d'abord, puis reseau (et on met en cache).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
