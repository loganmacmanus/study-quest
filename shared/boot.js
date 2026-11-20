/* Loads the private study content for window.GUIDE once access is confirmed, then starts the study app. */
(function () {
  "use strict";
  const CSQ = window.CSQ, GUIDE = window.GUIDE; if (!CSQ || !GUIDE || !/^[a-z0-9-]{2,32}$/.test(String(GUIDE.id))) return;
  const valid = (d) => d && typeof d === "object" && d.CH && d.N && d.IMG && Array.isArray(d.G) && Array.isArray(d.STATIC);
  const base = "/storage/v1/object/authenticated/content/";
  const esc = CSQ.esc;

  /* global preferences (sq_prefs, contract C1): animation classes on <html> as early as possible, kept in sync on change */
  function applyPrefs() {
    let o = null; try { o = JSON.parse(localStorage.getItem("sq_prefs")); } catch (e) { o = null; }
    o = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    const root = document.documentElement;
    root.classList.toggle("sq-anim-on", o.anim === "on"); root.classList.toggle("sq-anim-off", o.anim === "off"); root.classList.toggle("sq-muted", o.mute === 1 || o.mute === true);
  }
  applyPrefs();
  addEventListener("sq-prefs", applyPrefs);
  addEventListener("storage", (e) => { if (e.key === "sq_prefs" || e.key === null) applyPrefs(); });

  CSQ.onReady = async function () {
    if (window.SQ_SUGGEST) window.SQ_SUGGEST.enable(); // the user is signed in and approved here
    let data, file = GUIDE.id + ".json";
    try { data = await CSQ.call(base + file); }
    catch (e) {
      // the live CS 379 site stored its content as content.json before guides existed
      if (GUIDE.id === "cs379" && e && (e.status === 400 || e.status === 404)) {
        try { data = await CSQ.call(base + "content.json"); } catch (e2) { data = null; }
      }
    }
    if (!data) {
      const a = document.getElementById("auth"); a.hidden = false;
      a.innerHTML = '<div class="authcard"><h2>Study content missing</h2><p class="mut">The file ' + esc("content/" + file) + ' has not been uploaded to the private "content" bucket yet.</p></div>';
      return;
    }
    if (!valid(data)) return;
    // the study app reads these as globals
    window.CH = data.CH; window.N = data.N; window.IMG = data.IMG; window.G = data.G; window.STATIC = data.STATIC;
    // optional extra study pages (contract C5): validated and rendered by the study app
    window.PG = Array.isArray(data.PG) ? data.PG : [];
    // the study app looks for its leaderboard/user provider in window.CSQ_DB; give it ours
    const uid = CSQ.session.user.id, board = CSQ.boardAdapter(GUIDE.id);
    window.CSQ_DB = Object.freeze({ use: async (n) => n === "db" ? board : n === "user" ? { id: async () => uid } : null });

    // optional Proofs feature: only guides whose content has an "X" object load proofs.js (before app.js)
    const hasX = data.X && typeof data.X === "object" && !Array.isArray(data.X);
    if (hasX) window.X = data.X;
    const s = document.createElement("script"); s.src = "../shared/app.js?v=16"; s.defer = true;
    s.onload = buildNav;
    if (hasX) {
      const p = document.createElement("script"); p.src = "../shared/proofs.js?v=2"; p.defer = true;
      p.onload = () => document.body.appendChild(s);
      p.onerror = () => { delete window.X; document.body.appendChild(s); };
      document.body.appendChild(p);
    } else document.body.appendChild(s);
  };
  /* Side menu (replaces the old footer link bar): every guide, the hub, Admin (owner), Privacy, Terms and Sign out,
     reachable from anywhere through the ☰ button in the header. Built into #acct, which becomes a slide-in drawer. */
  function buildNav() {
    const bar = document.getElementById("acct"), row = document.querySelector("#hud .row");
    if (!bar || !row || document.getElementById("navbtn")) return;
    const here = (location.pathname.match(/\/([a-z0-9-]{2,40})\/(?:index\.html)?$/) || [])[1] || "";
    const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>';
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "ib"; btn.id = "navbtn"; btn.innerHTML = icon;
    btn.setAttribute("aria-label", "Open menu: switch guide, privacy, terms, sign out");
    btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-controls", "acct");
    row.insertBefore(btn, row.firstChild); row.classList.add("hasnav");
    const bk = document.createElement("div"); bk.id = "navbk"; document.body.appendChild(bk);

    const link = (href, ico, title, sub, cur) => '<a href="' + esc(href) + '"' + (cur ? ' aria-current="page"' : "") + '><span class="navi" aria-hidden="true">' + esc(ico) + '</span><span class="navt"><span>' + esc(title) + "</span>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span></a>";
    let rawGuides = null, upd = { unseen: 0, guide: false };   // rawGuides: storage keys from guides.json (for back up / restore)
    const myKeys = () => [{ storageKey: GUIDE.storageKey, legacyKeys: Array.isArray(GUIDE.legacyKeys) ? GUIDE.legacyKeys : [] }].filter((g) => /^[A-Za-z0-9_-]{1,40}$/.test(String(g.storageKey)));
    const keyList = () => rawGuides && rawGuides.length ? rawGuides : myKeys();
    const guideList = (list) => list.map((g) => link("../" + g.folder + "/", g.icon, g.name, g.test, g.folder === here)).join("");
    const fallback = [{ folder: here, icon: "📘", name: GUIDE.name || GUIDE.short || "This guide", test: GUIDE.test || "" }];
    function paint(list) {
      bar.innerHTML = '<div class="navh"><b>Study Quest</b><button type="button" class="ib navx" id="navclose" aria-label="Close menu">✕</button></div>'
        + '<nav aria-label="Study guides"><div class="navs">Guides</div>' + guideList(list) + link("../", "🏠", "All guides", "Hub with progress for each", false) + "</nav>"
        + '<div class="navs">More</div>' + (CSQ.isOwner() ? link("../admin.html", "🛡️", "Admin", "Approve people", false) : "")
        + link("../updates.html", "🔔", "Updates", "What changed", false)
        + link("../privacy.html", "🔒", "Privacy", "", false) + link("../terms.html", "📄", "Terms", "", false)
        + '<div class="navs">Settings</div><div id="navset"></div>'
        + '<button type="button" class="navl" id="signout"><span class="navi" aria-hidden="true">↩</span><span class="navt"><span>Sign out</span></span></button>'
        + '<div class="navcp">© 2026 Logan MacManus. All rights reserved.</div>';
      document.getElementById("signout").onclick = CSQ.signOut;
      if (window.SQ_SHELL) window.SQ_SHELL.settings(document.getElementById("navset"), { guides: keyList });
      dots();
      document.getElementById("navclose").onclick = () => toggle(false);
    }
    function dots() {
      const a = bar.querySelector('a[href$="updates.html"]');
      bar.querySelectorAll(".sq-dot").forEach((d) => d.remove()); btn.querySelectorAll(".sq-dot").forEach((d) => d.remove());
      if (!upd.unseen) { btn.setAttribute("aria-label", "Open menu: switch guide, privacy, terms, sign out"); return; }
      const mk = () => { const d = document.createElement("span"); d.className = "sq-dot" + (upd.guide ? " guide" : ""); d.setAttribute("aria-hidden", "true"); if (upd.guide) d.textContent = "NEW"; return d; };
      if (a) a.appendChild(mk());
      btn.appendChild(mk());
      btn.setAttribute("aria-label", "Open menu: switch guide, updates (new), privacy, terms, sign out");
    }
    if (window.SQ_SHELL) window.SQ_SHELL.checkUpdates("../updates.json").then((r) => { upd = r; dots(); });
    bar.className = "navd"; bar.setAttribute("role", "dialog"); bar.setAttribute("aria-modal", "true"); bar.setAttribute("aria-label", "Menu");
    bar.hidden = false;
    paint(fallback);
    fetch("../guides.json", { cache: "no-cache", credentials: "same-origin" }).then((r) => r.ok ? r.json() : null).then((j) => {
      if (!Array.isArray(j)) return;
      const ok = j.filter((g) => g && typeof g === "object" && /^[a-z0-9-]{2,40}$/.test(String(g.folder || g.id || "")) && typeof g.name === "string").slice(0, 30)
        .map((g) => ({ folder: String(g.folder || g.id), icon: String(g.icon || "📘").slice(0, 4), name: g.name.slice(0, 60), test: String(g.test || "").slice(0, 30) }));
      rawGuides = j.filter((g) => g && typeof g === "object" && /^[A-Za-z0-9_-]{1,40}$/.test(String(g.storageKey || ""))).slice(0, 60)
        .map((g) => ({ storageKey: String(g.storageKey), legacyKeys: Array.isArray(g.legacyKeys) ? g.legacyKeys.filter((k) => /^[A-Za-z0-9_-]{1,40}$/.test(String(k))).map(String).slice(0, 4) : [] }));
      if (ok.length) paint(ok);
    }).catch(() => {});

    let lastFocus = null;
    function toggle(open) {
      const isOpen = bar.classList.contains("open");
      if (open === isOpen) return;
      bar.classList.toggle("open", open); bk.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      if (open) { lastFocus = document.activeElement; const f = bar.querySelector('a[aria-current="page"]') || bar.querySelector("a,button"); if (f) f.focus(); }
      else if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    btn.onclick = () => toggle(!bar.classList.contains("open"));
    bk.onclick = () => toggle(false);
    document.addEventListener("keydown", (e) => {
      if (!bar.classList.contains("open")) return;
      e.stopPropagation();   // quiz shortcuts (1-4, A-D, Enter) must not fire behind the open menu
      if (e.key === "Escape") { e.preventDefault(); toggle(false); return; }
      if (e.key === "Tab") {   // keep focus inside the open menu
        const f = [...bar.querySelectorAll("a[href],button:not([disabled])")];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }, true);
  }
  CSQ.start();
})();
