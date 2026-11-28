/*
 * 📲 LE SERVICE WORKER DE L'APPLI WEB (2026-11-07) — Aeterna installée sur l'écran d'accueil se joue
 * aussi SANS CONNEXION. Enregistré par src/appli.ts, seulement sur la version web publiée (https, hors
 * localhost) : ni le serveur de dev, ni Electron, ni l'APK Android ne le chargent.
 *
 * Trois règles, aucune liste à tenir à jour :
 *   · la PAGE (navigation) : le réseau d'abord, la copie en cache si l'on est hors ligne — une mise à
 *     jour publiée arrive donc au lancement suivant ;
 *   · les fichiers HACHÉS (assets/…) : le cache d'abord, ils ne changent jamais sous le même nom ;
 *   · tout le reste (illustrations, sons, icônes) : la copie en cache tout de suite, rafraîchie en
 *     arrière-plan (une illustration retouchée arrive au chargement suivant).
 * Ce qui n'a jamais été vu en ligne n'est pas encore en cache : le jeu le met de côté au fil des parties.
 */
const CACHE = 'aeterna-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

const garder = (req, rep) => {
  if (rep && rep.ok && rep.type === 'basic') {
    const copie = rep.clone();
    caches.open(CACHE).then((c) => c.put(req, copie));
  }
  return rep;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Le fichier de version ne passe JAMAIS par le cache : c'est lui qui annonce les mises à jour (src/maj.ts).
  if (url.pathname.endsWith('/version.json')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      // « no-cache » : le navigateur revalide la page auprès du serveur — sinon le cache HTTP de GitHub
      // Pages (10 min) resservirait l'ancienne, avec les anciens fichiers.
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((rep) => garder(req, rep))
        .catch(() => caches.match(req).then((r) => r || caches.match(self.registration.scope))),
    );
    return;
  }
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((rep) => garder(req, rep))));
    return;
  }
  e.respondWith(
    caches.match(req).then((enCache) => {
      const frais = fetch(req)
        .then((rep) => garder(req, rep))
        .catch(() => enCache);
      return enCache || frais;
    }),
  );
});
