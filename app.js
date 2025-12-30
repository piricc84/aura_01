/* AURA - Studio Zen SPA PWA (vanilla) */
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const view = $("#view");
  const toast = $("#toast");

  const STORE_KEY = "aura_state_v1";
  const nowISO = () => new Date().toISOString();
  const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

  const defaultState = {
    profile: { name: "", goal: "Calma", reminders: true, sound: true, haptics: true, onboarded: false },
    pet: { level: 1, mood: 6, energy: 6, streak: 0, lastCheckInDay: null },
    checkins: []
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...defaultState,
        ...parsed,
        profile: { ...defaultState.profile, ...(parsed.profile || {}) },
        pet: { ...defaultState.pet, ...(parsed.pet || {}) },
        checkins: Array.isArray(parsed.checkins) ? parsed.checkins : []
      };
    } catch {
      return structuredClone(defaultState);
    }
  }
  function saveState(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

  let state = loadState();
  const sounds = {
    bell: new Audio("assets/audio/bell.wav"),
    breeze: new Audio("assets/audio/breeze.wav"),
    rain: new Audio("assets/audio/rain.wav")
  };
  Object.values(sounds).forEach((s) => {
    s.preload = "auto";
    s.volume = 0.35;
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function playSound(key) {
    if (!state.profile.sound) return;
    const s = sounds[key];
    if (!s) return;
    s.currentTime = 0;
    s.play().catch(() => {});
  }

  function vibrate(pattern = [10]) {
    if (!state.profile.haptics) return;
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function setActiveTab(route) {
    document.querySelectorAll(".tab").forEach((a) => {
      a.classList.toggle("active", route && a.dataset.route === route);
    });
  }

  function avgLast7() {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const items = state.checkins.filter((x) => new Date(x.ts).getTime() >= cutoff);
    if (!items.length) return { mood: null, stress: null, energy: null, n: 0 };
    const sum = (k) => items.reduce((a, x) => a + Number(x[k] || 0), 0);
    return {
      mood: sum("mood") / items.length,
      stress: sum("stress") / items.length,
      energy: sum("energy") / items.length,
      n: items.length
    };
  }

  function evolvePetFromLastCheckin(ci) {
    const score = (ci.mood * 1.1 + ci.energy * 0.8) - (ci.stress * 1.0);
    if (score >= 10) state.pet.level = Math.min(5, state.pet.level + 1);
    if (score <= 3) state.pet.level = Math.max(1, state.pet.level - 1);

    state.pet.mood = Math.round((state.pet.mood * 0.6) + (ci.mood * 0.4));
    state.pet.energy = Math.round((state.pet.energy * 0.6) + (ci.energy * 0.4));
  }

  function updateStreakForToday() {
    const t = todayKey();
    if (state.pet.lastCheckInDay === t) return;
    if (!state.pet.lastCheckInDay) {
      state.pet.streak = 1;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yk = todayKey(yesterday);
      state.pet.streak = (state.pet.lastCheckInDay === yk) ? (state.pet.streak + 1) : 1;
    }
    state.pet.lastCheckInDay = t;
  }

  function petLabel() {
    const lvl = state.pet.level;
    return ["Germoglio", "Fiore", "Lanterna", "Totem", "Aura Maestra"][lvl - 1] || "Germoglio";
  }
  function petImage() {
    const lvl = Math.min(5, Math.max(1, state.pet.level));
    return `assets/pets/pet-${lvl}.svg`;
  }

  function supportiveMessage() {
    const m = state.pet.mood, e = state.pet.energy;
    if (m >= 8) return "Oggi sei in ottima vibrazione. Proteggila con 1 minuto di respiro.";
    if (m >= 6 && e >= 6) return "Stai reggendo bene. Piccolo check-in e vai.";
    if (m <= 4) return "Giornata pesante: facciamo una cosa piccola e gentile per te.";
    if (e <= 4) return "Energia bassa: riduci il rumore, 60 secondi di calma e una nota.";
    return "Un passo alla volta. Un respiro, poi scegli la prossima micro-azione.";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[c]));
  }

  function formatValue(v) {
    return (v === null || Number.isNaN(v)) ? "-" : v.toFixed(1);
  }

  function headerCard(title, subtitle) {
    return `
      <section class="card hero">
        <div class="screen-title">${title}</div>
        <div class="screen-sub">${subtitle}</div>
      </section>
    `;
  }

  function rangeField(label, id, val, left, right) {
    return `
      <section class="card wave">
        <div class="card-row">
          <div>
            <div class="card-title">${label}</div>
            <div class="card-sub">0-10</div>
          </div>
          <button class="pill-btn ghost" data-focus="${id}">Azione</button>
        </div>
        <div class="field">
          <input id="${id}" type="range" min="0" max="10" value="${val}" />
          <div class="rangeRow"><span>${left}</span><span id="${id}Val">${val}</span><span>${right}</span></div>
        </div>
      </section>
    `;
  }

  function bindRanges() {
    ["mood", "stress", "energy"].forEach((id) => {
      const el = $("#" + id);
      const out = $("#" + id + "Val");
      if (!el || !out) return;
      const sync = () => out.textContent = el.value;
      el.addEventListener("input", sync);
      sync();
    });
    document.querySelectorAll("[data-focus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.focus;
        const el = $("#" + id);
        if (el) el.focus();
      });
    });
  }

  function bindLinkButtons() {
    document.querySelectorAll("[data-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        location.hash = btn.dataset.link;
      });
    });
  }

  function buildTips(avg) {
    if (!avg.n) return [
      "Fai un check-in oggi (10s).",
      "Prova 60s di respiro.",
      "Scrivi 1 frase nel diario."
    ];
    const tips = [];
    if (avg.stress >= 6) tips.push("Stress alto: fai 2 pause micro (60s) a meta mattina e meta pomeriggio.");
    else tips.push("Mantieni la costanza: 1 check-in al giorno vale piu di sessioni lunghe.");
    if (avg.energy <= 4) tips.push("Energia bassa: luce, acqua, e una camminata di 5 minuti se puoi.");
    else tips.push("Energia ok: usa 60s di respiro prima di un task difficile.");
    if (avg.mood <= 5) tips.push("Umore basso: scegli una sola cosa gentile da fare per te oggi.");
    else tips.push("Umore buono: proteggilo riducendo una fonte di rumore (notifiche, multitask).");
    return tips.slice(0, 3);
  }

  const routes = {
    "/": renderOnboarding,
    "/login": renderLogin,
    "/home": renderHome,
    "/checkin": renderCheckin,
    "/breath": renderBreath,
    "/journal": renderJournal,
    "/insights": renderInsights,
    "/rewards": renderRewards,
    "/settings": renderSettings,
    "/profile": renderProfile,
    "/screens": renderScreens
  };

  function navigate() {
    const hash = location.hash || "#/";
    const route = hash.replace("#", "");
    const fn = routes[route] || renderHome;

    if (!state.profile.onboarded && route !== "/") {
      location.hash = "#/"; return;
    }
    if (state.profile.onboarded && !state.profile.name && route !== "/login" && route !== "/") {
      location.hash = "#/login"; return;
    }

    setActiveTab(route.startsWith("/home") || route.startsWith("/checkin") || route.startsWith("/breath") || route.startsWith("/journal") || route.startsWith("/profile") ? route : null);
    fn();
    bindRanges();
    bindLinkButtons();
  }

  function renderOnboarding() {
    setActiveTab(null);
    const selected = state.profile.goal || "Calma";
    view.innerHTML = `
      ${headerCard("AURA", "Studio Zen - benvenuto")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">1 minuto</div>
            <div class="card-sub">Scegli il tuo obiettivo di calma</div>
          </div>
          <button class="pill-btn" id="goalAction">Azione</button>
        </div>
        <div class="chip-row">
          ${["Calma", "Focus", "Gentilezza", "Sonno"].map((g) => `
            <button class="chip ${g === selected ? "active" : ""}" data-goal="${g}">${g}</button>
          `).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Privacy</div>
            <div class="card-sub">Dati solo in locale, sempre tuoi</div>
          </div>
          <button class="pill-btn ghost" id="privacyAction">Azione</button>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Inizia</div>
            <div class="card-sub">Crea il tuo compagno zen</div>
          </div>
          <button class="pill-btn primary" id="start">Azione</button>
        </div>
      </section>
    `;

    view.querySelectorAll("[data-goal]").forEach((b) => {
      b.addEventListener("click", () => {
        view.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        b.classList.add("active");
        state.profile.goal = b.dataset.goal;
        saveState(state);
      });
    });
    $("#goalAction").addEventListener("click", () => {
      showToast("Obiettivo: " + state.profile.goal);
      vibrate([12]);
    });
    $("#start").addEventListener("click", () => {
      state.profile.onboarded = true;
      saveState(state);
      location.hash = "#/login";
    });
    $("#privacyAction").addEventListener("click", () => {
      showToast("Solo locale: puoi esportare e importare i dati.");
    });
  }

  function renderLogin() {
    setActiveTab(null);
    view.innerHTML = `
      ${headerCard("Accesso", "Rientra nel tuo spazio")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Email / Nick</div>
            <div class="card-sub">Inserisci o continua come ospite</div>
          </div>
          <button class="pill-btn ghost" data-focus="name">Azione</button>
        </div>
        <div class="field">
          <input id="name" type="text" placeholder="Es. Pietro" value="${escapeHtml(state.profile.name || "")}"/>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Codice</div>
            <div class="card-sub">Opzionale (solo locale)</div>
          </div>
          <button class="pill-btn ghost" data-focus="code">Azione</button>
        </div>
        <div class="field">
          <input id="code" type="text" placeholder="Facoltativo"/>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Continua</div>
            <div class="card-sub">Vai alla Home</div>
          </div>
          <button class="pill-btn primary" id="enter">Azione</button>
        </div>
      </section>
      <section class="card">
        <div class="card-title">Mini-demo</div>
        <div class="card-sub">1) Check-in (10s) -> 2) Respiro (60s) -> 3) Nota (20s) e il pet evolve.</div>
      </section>
    `;
    $("#enter").addEventListener("click", () => {
      const v = $("#name").value.trim();
      state.profile.name = v || "Ospite";
      saveState(state);
      vibrate([10, 40, 10]);
      location.hash = "#/home";
    });
  }

  function renderHome() {
    const avg = avgLast7();
    view.innerHTML = `
      ${headerCard("Casa", "Il tuo compagno zen oggi")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Stato</div>
            <div class="card-sub">Calma - Energia - Streak</div>
          </div>
          <button class="pill-btn ghost" data-link="/insights">Azione</button>
        </div>
        <div class="petWrap">
          <div class="pet"><img src="${petImage()}" alt="Pet"/></div>
          <div style="flex:1">
            <div class="small">${supportiveMessage()}</div>
            <div class="grid2" style="margin-top:10px;">
              <div class="kpi"><div class="k">Calma</div><div class="v">${state.pet.mood}/10</div></div>
              <div class="kpi"><div class="k">Energia</div><div class="v">${state.pet.energy}/10</div></div>
              <div class="kpi"><div class="k">Streak</div><div class="v">${state.pet.streak}</div></div>
              <div class="kpi"><div class="k">Goal</div><div class="v">${escapeHtml(state.profile.goal)}</div></div>
            </div>
          </div>
        </div>
        <div class="small" style="margin-top:10px;">Livello ${state.pet.level} - ${petLabel()}</div>
      </section>

      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Micro-missione</div>
            <div class="card-sub">1 check-in + 1 respiro + 1 nota</div>
          </div>
          <button class="pill-btn" data-link="/checkin">Azione</button>
        </div>
        <div class="grid2" style="margin-top:10px;">
          <button class="btn-block primary" data-link="/checkin">Check-in</button>
          <button class="btn-block" data-link="/breath">Respiro 60s</button>
          <button class="btn-block" data-link="/journal">Nota veloce</button>
          <button class="btn-block" data-link="/insights">Insight</button>
        </div>
      </section>

      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Personalizza</div>
            <div class="card-sub">Colori, suoni, pet</div>
          </div>
          <button class="pill-btn ghost" data-link="/rewards">Azione</button>
        </div>
        <div class="small" style="margin-top:10px;">Ultimi 7 giorni: ${avg.n ? `${avg.n} check-in` : "nessun dato ancora"}</div>
      </section>
    `;
  }

  function renderCheckin() {
    const last = state.checkins[state.checkins.length - 1];
    view.innerHTML = `
      ${headerCard("Check-in", "Come stai adesso?")}
      ${rangeField("Umore", "mood", last?.mood ?? 6, "Triste", "Sereno")}
      ${rangeField("Stress", "stress", last?.stress ?? 5, "Basso", "Alto")}
      ${rangeField("Energia", "energy", last?.energy ?? 6, "Scarico", "Carico")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Nota</div>
            <div class="card-sub">Opzionale</div>
          </div>
          <button class="pill-btn ghost" data-focus="note">Azione</button>
        </div>
        <div class="field">
          <textarea id="note" placeholder="Una frase, anche breve..."></textarea>
        </div>
        <button class="btn-block primary" id="save">Salva check-in</button>
      </section>
    `;
    $("#save").addEventListener("click", () => {
      const ci = {
        ts: nowISO(),
        mood: Number($("#mood").value),
        stress: Number($("#stress").value),
        energy: Number($("#energy").value),
        note: ($("#note").value || "").trim()
      };
      state.checkins.push(ci);
      updateStreakForToday();
      evolvePetFromLastCheckin(ci);
      saveState(state);
      vibrate([12, 30, 12]);
      playSound("bell");
      showToast("Check-in salvato.");
      location.hash = "#/home";
    });
  }

  function renderBreath() {
    view.innerHTML = `
      ${headerCard("Respiro", "Guida 60s")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Ritmo</div>
            <div class="card-sub">Inspira - Trattieni - Espira (4-2-6)</div>
          </div>
          <button class="pill-btn ghost" id="start">Azione</button>
        </div>
        <div class="kpi" style="text-align:center; margin-top:10px;">
          <div class="k">Fase</div>
          <div id="phase" class="v" style="font-size:30px;">Pronto</div>
          <div class="small" id="timer" style="margin-top:6px;">60s</div>
        </div>
        <button class="btn-block" id="stop" style="margin-top:10px;">Stop</button>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Haptics</div>
            <div class="card-sub">Vibrazione soft</div>
          </div>
          <button class="pill-btn" id="hap">${state.profile.haptics ? "ON" : "OFF"}</button>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Fine</div>
            <div class="card-sub">Nota un pensiero</div>
          </div>
          <button class="pill-btn ghost" data-link="/journal">Azione</button>
        </div>
      </section>
    `;
    const phaseEl = $("#phase");
    const timerEl = $("#timer");
    let t = 60;
    let iv = null;

    function setPhase(p) {
      phaseEl.textContent = p;
      if (p === "Inspira") vibrate([10]);
      if (p === "Trattieni") vibrate([6, 20, 6]);
      if (p === "Espira") vibrate([16]);
    }

    function tick() {
      t -= 1;
      timerEl.textContent = `${t}s`;
      const cycle = 12;
      const pos = (60 - t) % cycle;
      if (pos === 1) setPhase("Inspira");
      if (pos === 5) setPhase("Trattieni");
      if (pos === 7) setPhase("Espira");
      if (t <= 0) {
        clearInterval(iv); iv = null;
        setPhase("Fatto.");
        playSound("bell");
        showToast("Ottimo. Un passo alla volta.");
      }
    }

    $("#start").addEventListener("click", () => {
      if (iv) return;
      t = 60; timerEl.textContent = "60s";
      setPhase("Inspira");
      playSound("breeze");
      iv = setInterval(tick, 1000);
    });
    $("#stop").addEventListener("click", () => {
      if (iv) clearInterval(iv);
      iv = null;
      setPhase("Stop");
      timerEl.textContent = "60s";
    });
    $("#hap").addEventListener("click", () => {
      state.profile.haptics = !state.profile.haptics;
      saveState(state);
      $("#hap").textContent = state.profile.haptics ? "ON" : "OFF";
      showToast("Haptics: " + (state.profile.haptics ? "ON" : "OFF"));
    });
  }

  function renderJournal() {
    view.innerHTML = `
      ${headerCard("Diario", "Scrivi 2 righe")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Nota</div>
            <div class="card-sub">Cosa ti ha aiutato oggi?</div>
          </div>
          <button class="pill-btn ghost" data-focus="jNote">Azione</button>
        </div>
        <div class="field">
          <textarea id="jNote" placeholder="Scrivi qui..."></textarea>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Gratitudine</div>
            <div class="card-sub">Una cosa piccola</div>
          </div>
          <button class="pill-btn ghost" data-focus="jGrat">Azione</button>
        </div>
        <div class="field">
          <textarea id="jGrat" placeholder="Anche minimale..."></textarea>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Salva</div>
            <div class="card-sub">Aggiorna il pet</div>
          </div>
          <button class="pill-btn primary" id="saveJ">Azione</button>
        </div>
        <div class="small" style="margin-top:10px;">Le note si agganciano all'ultimo check-in di oggi o creano un check-in solo nota.</div>
      </section>
    `;
    $("#saveJ").addEventListener("click", () => {
      const note = ($("#jNote").value || "").trim();
      const grat = ($("#jGrat").value || "").trim();
      if (!note && !grat) { showToast("Scrivi almeno 1 parola"); return; }
      const chunk = [note, grat ? `Gratitudine: ${grat}` : ""].filter(Boolean).join("\n");
      const last = state.checkins[state.checkins.length - 1];
      if (last && todayKey(new Date(last.ts)) === todayKey()) {
        last.note = (last.note ? (last.note + "\n") : "") + chunk;
      } else {
        state.checkins.push({
          ts: nowISO(),
          mood: state.pet.mood,
          stress: 5,
          energy: state.pet.energy,
          note: chunk
        });
        updateStreakForToday();
      }
      saveState(state);
      vibrate([10]);
      playSound("rain");
      showToast("Nota salvata.");
      location.hash = "#/home";
    });
  }

  function renderInsights() {
    const avg = avgLast7();
    const tips = buildTips(avg);
    view.innerHTML = `
      ${headerCard("Insight", "Trend ultimi 7 giorni")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Umore</div>
            <div class="card-sub">Media e variazione</div>
          </div>
          <button class="pill-btn ghost" data-link="/checkin">Azione</button>
        </div>
        <div class="grid2" style="margin-top:10px;">
          <div class="kpi"><div class="k">Media</div><div class="v">${formatValue(avg.mood)}</div></div>
          <div class="kpi"><div class="k">Energia media</div><div class="v">${formatValue(avg.energy)}</div></div>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Stress</div>
            <div class="card-sub">Picchi e orari</div>
          </div>
          <button class="pill-btn ghost" data-link="/breath">Azione</button>
        </div>
        <div class="kpi" style="margin-top:10px;">
          <div class="k">Media</div>
          <div class="v">${formatValue(avg.stress)}</div>
        </div>
        <div class="small" style="margin-top:6px;">Check-in totali: ${avg.n || 0}</div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Consigli</div>
            <div class="card-sub">3 azioni pratiche</div>
          </div>
          <button class="pill-btn primary" data-link="/breath">Azione</button>
        </div>
        <div class="small" style="margin-top:10px;">${tips.map((t) => `- ${escapeHtml(t)}`).join("<br/>")}</div>
      </section>
    `;
  }

  function renderRewards() {
    const unlocked = Math.min(10, 1 + state.pet.level + Math.floor(state.pet.streak / 3));
    view.innerHTML = `
      ${headerCard("Ricompense", "Sblocchi e cosmetici")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Badge</div>
            <div class="card-sub">Streak, gentilezza, focus</div>
          </div>
          <button class="pill-btn ghost" data-link="/home">Azione</button>
        </div>
        <div class="grid2" style="margin-top:10px;">
          <div class="kpi"><div class="k">Livello</div><div class="v">${state.pet.level}</div></div>
          <div class="kpi"><div class="k">Streak</div><div class="v">${state.pet.streak}</div></div>
        </div>
        <div class="petRow" style="margin-top:10px;">
          ${[1,2,3,4,5].map((lvl) => `
            <div class="pet tiny ${lvl <= state.pet.level ? "" : "locked"}"><img src="assets/pets/pet-${lvl}.svg" alt="Pet livello ${lvl}"/></div>
          `).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Shop</div>
            <div class="card-sub">Gratis, niente paywall</div>
          </div>
          <button class="pill-btn" data-link="/profile">Azione</button>
        </div>
        <div class="small" style="margin-top:10px;">Sbloccati: ${unlocked}/10 cosmetici</div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Suoni</div>
            <div class="card-sub">Campane, vento, pioggia</div>
          </div>
          <button class="pill-btn ghost" data-link="/settings">Azione</button>
        </div>
        <div class="small" style="margin-top:10px;">Attiva o disattiva i suoni dalle Impostazioni.</div>
      </section>
    `;
  }

  function renderSettings() {
    view.innerHTML = `
      ${headerCard("Impostazioni", "Semplice e pulito")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Notifiche</div>
            <div class="card-sub">Reminder check-in</div>
          </div>
          <button class="pill-btn" id="rem">${state.profile.reminders ? "ON" : "OFF"}</button>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Audio</div>
            <div class="card-sub">Volume e toggle</div>
          </div>
          <button class="pill-btn" id="snd">${state.profile.sound ? "ON" : "OFF"}</button>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Backup</div>
            <div class="card-sub">Export/Import JSON</div>
          </div>
          <button class="pill-btn primary" id="exportBtn">Azione</button>
        </div>
        <div class="field">
          <label>Import JSON</label>
          <input id="importFile" type="file" accept="application/json"/>
        </div>
        <button class="btn-block" id="reset" style="margin-top:6px;">Reset dati (locale)</button>
      </section>
    `;
    $("#rem").addEventListener("click", () => {
      state.profile.reminders = !state.profile.reminders;
      saveState(state);
      $("#rem").textContent = state.profile.reminders ? "ON" : "OFF";
      showToast("Reminder: " + (state.profile.reminders ? "ON" : "OFF"));
    });
    $("#snd").addEventListener("click", () => {
      state.profile.sound = !state.profile.sound;
      saveState(state);
      $("#snd").textContent = state.profile.sound ? "ON" : "OFF";
      showToast("Audio: " + (state.profile.sound ? "ON" : "OFF"));
    });
    $("#exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `aura-backup-${todayKey()}.json`;
      a.click();
      showToast("Export pronto.");
    });
    $("#reset").addEventListener("click", () => {
      if (!confirm("Resetto TUTTI i dati locali?")) return;
      state = structuredClone(defaultState);
      saveState(state);
      showToast("Reset completato");
      location.hash = "#/";
    });
    $("#importFile").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const txt = await file.text();
        const obj = JSON.parse(txt);
        state = {
          ...defaultState,
          ...obj,
          profile: { ...defaultState.profile, ...(obj.profile || {}) },
          pet: { ...defaultState.pet, ...(obj.pet || {}) },
          checkins: Array.isArray(obj.checkins) ? obj.checkins : []
        };
        saveState(state);
        showToast("Import OK");
        location.hash = "#/home";
      } catch {
        showToast("Import fallito");
      }
    });
  }

  function renderProfile() {
    view.innerHTML = `
      ${headerCard("Profilo", "Nome e obiettivo")}
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Nome</div>
            <div class="card-sub">Come vuoi essere chiamato</div>
          </div>
          <button class="pill-btn ghost" data-focus="pn">Azione</button>
        </div>
        <div class="field">
          <input id="pn" type="text" value="${escapeHtml(state.profile.name || "")}" placeholder="Es. Ospite"/>
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Obiettivo</div>
            <div class="card-sub">Scegli il focus principale</div>
          </div>
          <button class="pill-btn ghost" id="saveP">Azione</button>
        </div>
        <div class="chip-row">
          ${["Calma", "Focus", "Gentilezza", "Sonno"].map((g) => `
            <button class="chip ${g === state.profile.goal ? "active" : ""}" data-goal="${g}">${g}</button>
          `).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-row">
          <div>
            <div class="card-title">Info</div>
            <div class="card-sub">AURA - Studio Zen</div>
          </div>
          <button class="pill-btn ghost" data-link="/screens">Azione</button>
        </div>
        <div class="small" style="margin-top:10px;">Versione: PWA offline-first</div>
        <div class="small">Supporto: suggerimenti e bug</div>
        <div class="small">Crediti: icone/SVG inclusi</div>
      </section>
    `;
    view.querySelectorAll("[data-goal]").forEach((b) => {
      b.addEventListener("click", () => {
        view.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        b.classList.add("active");
        state.profile.goal = b.dataset.goal;
      });
    });
    $("#saveP").addEventListener("click", () => {
      state.profile.name = $("#pn").value.trim() || "Ospite";
      state.profile.goal = state.profile.goal || "Calma";
      saveState(state);
      showToast("Profilo aggiornato");
    });
  }

  function renderScreens() {
    setActiveTab(null);
    view.innerHTML = `
      ${headerCard("Screens", "Mockup di riferimento")}
      ${Array.from({ length: 10 }).map((_, i) => {
        const n = String(i + 1).padStart(2, "0");
        const file = `assets/mockups/${n}_${mockupName(i)}.png`;
        return `
          <section class="card">
            <div class="card-title">Mockup ${n}</div>
            <img class="mockup" src="${file}" alt="Mockup ${n}"/>
          </section>
        `;
      }).join("")}
    `;
  }

  function mockupName(i) {
    return ["onboarding", "login", "home_pet", "checkin", "breathing", "journal", "insights", "rewards", "settings", "about"][i];
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  window.addEventListener("hashchange", navigate);
  navigate();
})();
