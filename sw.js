// AURA - Studio Zen offline-first cache
const CACHE = "aura-cache-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/logo.svg",
  "./assets/pet.svg",
  "./assets/bg.svg",
  "./assets/icons/home.svg",
  "./assets/icons/checkin.svg",
  "./assets/icons/breath.svg",
  "./assets/icons/journal.svg",
  "./assets/icons/profile.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/illustrations/orb.svg",
  "./assets/illustrations/wave.svg",
  "./assets/pets/pet-1.svg",
  "./assets/pets/pet-2.svg",
  "./assets/pets/pet-3.svg",
  "./assets/pets/pet-4.svg",
  "./assets/pets/pet-5.svg",
  "./assets/audio/bell.wav",
  "./assets/audio/breeze.wav",
  "./assets/audio/rain.wav",
  "./assets/mockups/01_onboarding.png",
  "./assets/mockups/02_login.png",
  "./assets/mockups/03_home_pet.png",
  "./assets/mockups/04_checkin.png",
  "./assets/mockups/05_breathing.png",
  "./assets/mockups/06_journal.png",
  "./assets/mockups/07_insights.png",
  "./assets/mockups/08_rewards.png",
  "./assets/mockups/09_settings.png",
  "./assets/mockups/10_about.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE) ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((cached) => cached || fetch(req))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
