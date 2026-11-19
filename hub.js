/* Study Quest hub: lists the guides from guides.json with this device's saved progress. */
(function () {
  "use strict";
  // old score-transfer links point at the site root: send them to the CS 379 guide, hash intact
  if (/^#sync-/.test(location.hash)) { location.replace("./cs379-quest/" + location.hash); return; }

  const $ = (s) => document.querySelector(s);
  const PER = 150; // XP per level: same formula as the study app's lvl()
  const PREF = "hub_prefs";
  const root = document.documentElement;

  /* ---------- global preferences (sq_prefs, contract C1): animation classes on <html> as early as possible ---------- */
  function sqPrefs() {
    let o = null; try { o = JSON.parse(localStorage.getItem("sq_prefs")); } catch (e) { o = null; }
    o = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    return { mute: o.mute === 1 || o.mute === true ? 1 : 0, anim: o.anim === "on" || o.anim === "off" ? o.anim : "auto", hubmus: o.hubmus === 0 || o.hubmus === false ? 0 : 1 };
  }
  function applyPrefs() {
    const p = sqPrefs();
    root.classList.toggle("sq-anim-on", p.anim === "on"); root.classList.toggle("sq-anim-off", p.anim === "off"); root.classList.toggle("sq-muted", p.mute === 1);
    const m = $("#hmus");
    if (m) {
      const playing = p.hubmus && !p.mute;
      m.textContent = playing ? "🎵" : "🔇"; m.classList.toggle("off", !playing); m.setAttribute("aria-pressed", String(!!p.hubmus));
      m.title = p.mute ? "Hub music (all sounds are muted in Settings)" : p.hubmus ? "Hub music is on" : "Hub music is off";
    }
  }
  applyPrefs();
  addEventListener("sq-prefs", applyPrefs);
  addEventListener("storage", (e) => { if (e.key === "sq_prefs" || e.key === null) applyPrefs(); });

  /* ---------- theme ---------- */
  function readPrefs() { try { const o = JSON.parse(localStorage.getItem(PREF)); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
  function savedTheme(guides) {
    const p = readPrefs();
    if (p.theme === "light" || p.theme === "dark") return p.theme;
    for (const g of guides || []) { const s = readState(g); if (s && (s.theme === "light" || s.theme === "dark")) return s.theme; }
    return null; // follow the system setting
  }
  const dark = () => root.dataset.theme ? root.dataset.theme === "dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);

  /* ---------- contrast: nudge each accent so the stripe and bar reach 3:1 in the current theme ---------- */
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lum = (c) => { const f = c.map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  function fit(accent, isDark) {
    const bgs = isDark ? [[42, 28, 19], [61, 42, 27]] : [[255, 250, 242], [236, 220, 195]];
    const to = isDark ? 255 : 0;
    // warm the guide colour slightly toward caramel so every card harmonizes with the brown theme, while keeping its hue
    const car = isDark ? [224, 165, 96] : [181, 112, 47];
    let c = rgb(accent).map((v, i) => (v * 0.8 + car[i] * 0.2));
    for (let t = 0; t <= 20; t++) {
      const m = c.map((v) => v + (to - v) * (t * .05));
      if (bgs.every((b) => ratio(m, b) >= 3)) return hex(m);
    }
    return hex(c.map((v) => v + (to - v)));
  }
  function paint() { document.querySelectorAll(".gcard").forEach((a) => a.style.setProperty("--g", fit(a.dataset.accent, dark()))); }

  function applyTheme(t) { if (t) root.dataset.theme = t; else delete root.dataset.theme; paint(); }

  /* ---------- guides.json ---------- */
  const str = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max;
  const keyOk = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);
  const cnt = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1e6 ? Math.floor(v) : 0);
  function clean(list) {
    if (!Array.isArray(list)) return [];
    const out = [], seen = new Set();
    for (const g of list.slice(0, 60)) {
      if (!g || typeof g !== "object") continue;
      if (typeof g.id !== "string" || !/^[a-z0-9-]{2,32}$/.test(g.id) || seen.has(g.id)) continue;
      if (typeof g.accent !== "string" || !/^#[0-9a-fA-F]{6}$/.test(g.accent)) continue;
      if (!str(g.name, 60) || !keyOk(g.storageKey)) continue;
      seen.add(g.id);
      out.push({
        id: g.id, folder: typeof g.folder === "string" && /^[a-z0-9-]{2,32}$/.test(g.folder) ? g.folder : g.id, name: g.name, accent: g.accent,
        test: str(g.test, 40) ? g.test : "",
        icon: str(g.icon, 16) ? g.icon : "📘",
        questions: cnt(g.questions), cards: cnt(g.cards),
        storageKey: g.storageKey,
        legacyKeys: Array.isArray(g.legacyKeys) ? g.legacyKeys.filter(keyOk).slice(0, 4) : []
      });
    }
    return out;
  }

  /* ---------- saved progress (untrusted input) ---------- */
  function readState(g) {
    for (const k of [g.storageKey].concat(g.legacyKeys)) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const o = JSON.parse(raw);
        if (o && typeof o === "object" && !Array.isArray(o)) return o;
      } catch (e) {}
    }
    return null;
  }
  function progress(g) {
    const s = readState(g);
    if (!s) return null;
    let xp = Math.floor(+s.xp); xp = Number.isFinite(xp) && xp >= 0 ? Math.min(xp, 1e7) : 0;
    const kn = s.known && typeof s.known === "object" && !Array.isArray(s.known) ? Object.keys(s.known).length : 0;
    const pct = g.cards > 0 ? Math.min(100, Math.round(100 * kn / g.cards)) : 0;
    // Knowledge studied (contract C2): S.ks = {d, n}; missing when the guide has not been opened since the update
    const k = s.ks && typeof s.ks === "object" && !Array.isArray(s.ks) ? s.ks : null;
    let ks = null;
    if (k && Number.isInteger(k.d) && Number.isInteger(k.n) && k.n > 0 && k.n <= 1e5 && k.d >= 0) { const d = Math.min(k.d, k.n); ks = { d, n: k.n, pct: Math.min(100, Math.round(100 * d / k.n)) }; }
    return { xp, level: Math.floor(xp / PER) + 1, known: kn, pct, ks };
  }

  /* ---------- daily streak: consecutive local days ending today or yesterday, in the union of every guide's S.dd ---------- */
  const dstr = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  function streakOf(dates, now) {
    const set = new Set();
    for (const v of dates) if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) set.add(v);
    const d = new Date((now || new Date()).getFullYear(), (now || new Date()).getMonth(), (now || new Date()).getDate());
    const today = set.has(dstr(d));
    if (!today) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(dstr(d)) && n < 400) { n++; d.setDate(d.getDate() - 1); }
    return { n, today };
  }
  function allDates(list) {
    const out = [];
    for (const g of list) { const st = readState(g); if (st && Array.isArray(st.dd)) out.push(...st.dd.slice(-120)); }
    return out;
  }
  function paintStreak() {
    const box = $("#streak"); if (!box) return;
    const r = streakOf(allDates(guides));
    box.textContent = "";
    const fire = el("span", "fire", "🔥"); fire.setAttribute("aria-hidden", "true");
    box.append(fire, r.n > 0 ? r.n + "-day streak" + (r.today ? "" : ". Study today to keep your streak") : "Study today to start a streak");
    box.hidden = false;
  }

  /* ---------- rendering (DOM nodes + textContent: nothing is parsed as HTML) ---------- */
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  const fmt = (n) => n.toLocaleString("en-US");

  function card(g) {
    const li = el("li"), a = el("a", "gcard");
    a.href = "./" + g.folder + "/"; a.dataset.accent = g.accent;
    const head = el("div", "ghead"), ico = el("span", "gico", g.icon); ico.setAttribute("aria-hidden", "true");
    const t = el("div"); t.appendChild(el("h2", "", g.name));
    if (g.test) t.appendChild(el("div", "gtest", g.test));
    head.append(ico, t); a.appendChild(head);

    const p = progress(g), st = el("div", "gstats");
    if (g.questions) { const d = el("span"); d.append(el("b", "", fmt(g.questions)), " questions"); st.appendChild(d); }
    if (p) {
      const l = el("span"); l.append("Level ", el("b", "", String(p.level))); st.appendChild(l);
      const x = el("span"); x.append(el("b", "", fmt(p.xp)), " XP"); st.appendChild(x);
    } else st.appendChild(el("span", "mut", "Not started"));
    a.appendChild(st);

    const ks = p && p.ks, pct = p ? (ks ? ks.pct : p.pct) : 0, bar = el("div", "bar"), fill = el("i");
    const kl = el("div", "gklab"); kl.append(el("span", "", "Knowledge studied"), el("span", "", pct + "%")); a.appendChild(kl);
    bar.setAttribute("role", "progressbar"); bar.setAttribute("aria-label", g.name + " knowledge studied");
    bar.setAttribute("aria-valuemin", "0"); bar.setAttribute("aria-valuemax", "100"); bar.setAttribute("aria-valuenow", String(pct));
    fill.style.width = pct + "%"; bar.appendChild(fill); a.appendChild(bar);
    a.appendChild(el("div", "gprog", ""));
    const pr = a.lastChild; pr.append(el("span", "", !p ? "No progress yet" : ks ? ks.d + " of " + ks.n + " topics" : p.known + " of " + g.cards + " cards known"));
    if (p && !ks) pr.append(el("span", "", "open the guide to update"));
    a.appendChild(el("div", "gcta", p ? "Continue →" : "Start →"));
    li.appendChild(a); return li;
  }

  function showEmpty(box, msg) {
    box.textContent = "";
    const d = el("div", "empty"); d.append(el("h2", "", "No guides to show"), el("p", "mut", msg));
    const b = el("button", "btn", "Try again"); b.type = "button"; b.onclick = load; d.appendChild(b);
    box.appendChild(d);
  }

  let guides = [];
  const fetchGuides = () => fetch("guides.json", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  let guidesP = fetchGuides(); // starts now, in parallel with the sign-in check; a retry fetches again
  guidesP.catch(() => {}); // a failure is reported by load(), not as an unhandled rejection
  async function load() {
    const box = $("#guides");
    let list;
    try {
      const p = guidesP || fetchGuides(); guidesP = null;
      list = clean(await p);
    } catch (e) { return showEmpty(box, "The guide list could not be loaded. Check your connection and try again."); }
    if (!list.length) return showEmpty(box, "There are no study guides here yet.");
    guides = list;
    applyTheme(savedTheme(guides));
    const ul = el("ul", "glist");
    list.forEach((g) => ul.appendChild(card(g)));
    box.textContent = ""; box.appendChild(ul); paint(); paintStreak();
  }

  /* ---------- updates bell ---------- */
  function bell() {
    const S = window.SQ_SHELL, a = $("#bell"), d = $("#bdot"); if (!S || !a || !d) return;
    S.checkUpdates("updates.json").then((r) => {
      d.hidden = r.unseen === 0; d.classList.toggle("guide", r.guide); d.textContent = r.guide ? "NEW" : "";
      a.setAttribute("aria-label", r.unseen ? (r.guide ? "Updates: a new guide was added" : "Updates: " + r.unseen + " new") : "Updates");
    });
  }

  /* ---------- settings dialog ---------- */
  function openSettings() {
    const S = window.SQ_SHELL; if (!S) return;
    const m = S.modal({ title: "Settings" });
    S.settings(m.dlg, { guides: () => guides });
    const first = m.dlg.querySelector("button.sq-r"); if (first) first.focus();
  }

  function footer() {
    const f = $("#foot"); f.textContent = ""; f.hidden = false;
    const mk = (href, txt) => { const a = el("a", "", txt); a.href = href; return a; };
    if (window.CSQ.isOwner()) f.appendChild(mk("admin.html", "Admin"));
    f.append(mk("privacy.html", "Privacy"), mk("terms.html", "Terms"));
    if (window.SQ_SHELL) { const st = el("button", "", "Settings"); st.type = "button"; st.id = "sett"; st.setAttribute("aria-haspopup", "dialog"); st.onclick = openSettings; f.appendChild(st); }
    const b = el("button", "", "Sign out"); b.type = "button"; b.onclick = window.CSQ.signOut; f.appendChild(b);
    f.appendChild(el("span", "cp", "© 2026 Logan MacManus. All rights reserved."));
  }

  /* ---------- start ---------- */
  applyTheme(savedTheme([{ storageKey: "cs379q3", legacyKeys: ["cs379q"] }])); // avoids a flash before guides.json arrives
  $("#thm").onclick = () => {
    const next = dark() ? "light" : "dark";
    try { localStorage.setItem(PREF, JSON.stringify(Object.assign(readPrefs(), { theme: next }))); } catch (e) {}
    applyTheme(next);
  };
  if (window.matchMedia) { const mq = matchMedia("(prefers-color-scheme: dark)"); const h = () => paint(); mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener && mq.addListener(h); }

  const CSQ = window.CSQ;
  if (!CSQ) { $("#guides").textContent = "Sign-in failed to load."; $("#main").hidden = false; return; }
  const hm = $("#hmus");
  if (hm) hm.onclick = () => { if (window.SQ_SHELL) window.SQ_SHELL.setPrefs({ hubmus: sqPrefs().hubmus ? 0 : 1 }); };
  CSQ.onReady = function () {
    $("#main").hidden = false; footer(); load(); bell();
    if (window.SQ_SUGGEST) window.SQ_SUGGEST.enable();
    if (window.SQ_HUBMUS) window.SQ_HUBMUS.arm();
  };
  CSQ.start();
})();
