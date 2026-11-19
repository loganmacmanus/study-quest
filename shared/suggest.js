/* Study Quest shell helpers shared by the hub and every guide page (loaded after web.js, before the page's own script).
   - window.SQ_SUGGEST: the round suggestion button and its dialog. open({kind, guide, qid, qtext}) opens it from anywhere.
     Sending goes through window.CSQ.suggest (web.js). The button appears after enable() (the page calls it once the user is signed in and approved).
   - window.SQ_SHELL: global preferences (sq_prefs), a small accessible modal, the settings rows (mute, animations, back up, restore)
     used by the guide side menu and the hub settings dialog, and the "unseen updates" check behind the bell dot.
   Strict CSP friendly: no inline script, no innerHTML, everything read from storage or files is validated. */
(function () {
  "use strict";
  const doc = document, root = doc.documentElement;
  const PK = "sq_prefs", SEEN = "sq_upd_seen";
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

  function h(tag, attrs, ...kids) {
    const e = doc.createElement(tag);
    if (attrs) for (const k in attrs) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); }
    for (const c of kids) if (c != null) e.append(c);
    return e;
  }
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  /* ---------- global preferences (contract C1) ---------- */
  function prefs() {
    let o = null;
    try { o = JSON.parse(lsGet(PK)); } catch (e) { o = null; }
    if (!o || typeof o !== "object" || Array.isArray(o)) o = {};
    return { mute: o.mute === 1 || o.mute === true ? 1 : 0, anim: o.anim === "on" || o.anim === "off" ? o.anim : "auto", hubmus: o.hubmus === 0 || o.hubmus === false ? 0 : 1 };
  }
  function applyClasses() {
    const p = prefs();
    root.classList.toggle("sq-anim-on", p.anim === "on");
    root.classList.toggle("sq-anim-off", p.anim === "off");
    root.classList.toggle("sq-muted", p.mute === 1);
  }
  function setPrefs(patch) {
    const p = Object.assign(prefs(), patch || {});
    lsSet(PK, JSON.stringify({ mute: p.mute ? 1 : 0, anim: p.anim === "on" || p.anim === "off" ? p.anim : "auto", hubmus: p.hubmus === 0 ? 0 : 1 }));
    applyClasses();
    window.dispatchEvent(new CustomEvent("sq-prefs"));
    return prefs();
  }
  applyClasses();
  addEventListener("storage", (e) => { if (e.key === PK || e.key === null) applyClasses(); });

  /* ---------- unseen updates (bell dot) ---------- */
  const goodTime = (t) => typeof t === "string" && ISO.test(t) && Number.isFinite(Date.parse(t));
  function checkUpdates(url) {
    const none = { unseen: 0, guide: false };
    return fetch(url, { cache: "no-cache", credentials: "same-origin" }).then((r) => r.ok ? r.json() : null).then((j) => {
      if (!j || !Array.isArray(j.items)) return none;
      const seenRaw = lsGet(SEEN), seen = goodTime(seenRaw) ? Date.parse(seenRaw) : -Infinity;
      let n = 0, g = false;
      for (const it of j.items.slice(0, 200)) {
        if (!it || typeof it !== "object" || !goodTime(it.t) || typeof it.title !== "string") continue;
        if (Date.parse(it.t) > seen) { n++; if (it.type === "guide") g = true; }
      }
      return { unseen: n, guide: g };
    }).catch(() => none);
  }

  /* ---------- modal with focus trap ---------- */
  let mid = 0;
  function modal(o) {
    const last = doc.activeElement, id = "sq-mt" + (++mid);
    const ov = h("div", { class: "sq-ov" });
    const dlg = h("div", { class: "sq-dlg", role: "dialog", "aria-modal": "true", "aria-labelledby": id });
    const title = h("h2", { id }, o.title || "");
    const x = h("button", { type: "button", class: "sq-x", "aria-label": "Close" }, "✕");
    dlg.append(h("div", { class: "sq-dh" }, title, x));
    ov.append(dlg); doc.body.append(ov); root.classList.add("sq-lock");
    let closed = false;
    function key(e) {
      if (!dlg.isConnected) { doc.removeEventListener("keydown", key, true); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        const f = [...dlg.querySelectorAll('button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="file"]),a[href]')].filter((n) => n.offsetParent !== null || n === doc.activeElement);
        if (!f.length) { e.preventDefault(); return; }
        const first = f[0], lastEl = f[f.length - 1], a = doc.activeElement;
        if (!dlg.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && a === lastEl) { e.preventDefault(); first.focus(); }
        e.stopPropagation(); return;
      }
      e.stopPropagation(); // quiz shortcuts must not fire behind an open dialog
    }
    function close() {
      if (closed) return; closed = true;
      doc.removeEventListener("keydown", key, true);
      ov.remove(); root.classList.remove("sq-lock");
      if (o.onClose) o.onClose();
      if (last && last.isConnected && last.focus) last.focus();
    }
    doc.addEventListener("keydown", key, true);
    x.addEventListener("click", close);
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    return { ov, dlg, close, setTitle: (t) => { title.textContent = t; } };
  }

  /* ---------- settings rows: mute, animations, back up, restore ---------- */
  const BACKUP_MAX = 2 * 1024 * 1024;
  const keyOk = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const ymd = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  /* guides: () => [{storageKey, legacyKeys?}]. Returns the keys that may be backed up / restored (plus sq_prefs). */
  function knownKeys(guides) {
    const ks = new Set();
    for (const g of (guides() || []).slice(0, 60)) {
      if (g && keyOk(g.storageKey)) ks.add(g.storageKey);
      if (g && Array.isArray(g.legacyKeys)) g.legacyKeys.filter(keyOk).slice(0, 4).forEach((k) => ks.add(k));
    }
    ks.add(PK);
    return ks;
  }
  function makeBackup(guides) {
    const data = {};
    for (const g of (guides() || []).slice(0, 60)) {
      if (!g || !keyOk(g.storageKey)) continue;
      try { const o = JSON.parse(lsGet(g.storageKey)); if (isObj(o)) data[g.storageKey] = o; } catch (e) { /* not saved yet */ }
    }
    data[PK] = prefs();
    return { studyQuestBackup: 1, created: new Date().toISOString(), data };
  }
  /* Validates a parsed backup file. Returns {error} or {items: {key: object}, guides: n}. Unknown keys are ignored, never written. */
  function parseBackup(j, known) {
    if (!isObj(j) || j.studyQuestBackup !== 1 || !isObj(j.data)) return { error: "That file is not a Study Quest backup." };
    const items = {}; let guides = 0;
    for (const k of Object.keys(j.data)) {
      if (!known.has(k)) continue;
      const v = j.data[k];
      if (!isObj(v)) return { error: "The backup has damaged data for " + k + ". Nothing was changed." };
      if (k === PK) items[k] = { mute: v.mute === 1 ? 1 : 0, anim: v.anim === "on" || v.anim === "off" ? v.anim : "auto", hubmus: v.hubmus === 0 ? 0 : 1 };
      else { items[k] = v; guides++; }
    }
    if (!Object.keys(items).length) return { error: "That backup has no progress for the guides on this site." };
    return { items, guides };
  }

  function settings(box, opts) {
    opts = opts || {};
    const guides = typeof opts.guides === "function" ? opts.guides : () => [];
    const set = h("div", { class: "sq-set" });
    const msg = h("div", { class: "sq-msg", role: "status", "aria-live": "polite" });
    const say = (t, cls) => { msg.className = "sq-msg" + (cls ? " " + cls : ""); msg.textContent = t || ""; };
    const row = (ico, title, sub, tag) => {
      const r = h(tag || "button", tag ? { class: "sq-r" } : { type: "button", class: "sq-r" });
      r.append(h("span", { class: "sq-ri", "aria-hidden": "true" }, ico), h("span", { class: "sq-rt" }, h("span", null, title), sub ? h("small", null, sub) : null));
      return r;
    };

    const mute = row("🔇", "Mute all sounds", "Music and sound effects, everywhere");
    mute.setAttribute("role", "switch"); mute.id = "sq-mute"; mute.append(h("span", { class: "sq-tog", "aria-hidden": "true" }));
    mute.addEventListener("click", () => { setPrefs({ mute: prefs().mute ? 0 : 1 }); });

    const anim = row("✨", "Animations", "", "div"); anim.id = "sq-anim"; anim.setAttribute("role", "group"); anim.setAttribute("aria-label", "Animations");
    const ms = h("div", { class: "sq-ms" });
    [["auto", "Auto"], ["on", "On"], ["off", "Off"]].forEach(([v, t]) => {
      const b = h("button", { type: "button", "data-anim": v }, t);
      b.addEventListener("click", () => { setPrefs({ anim: v }); });
      ms.append(b);
    });
    anim.querySelector(".sq-rt").append(ms);

    const bk = row("💾", "Back up progress", "Download a file with your progress"); bk.id = "sq-backup";
    const rs = row("📂", "Restore progress", "Load a backup file"); rs.id = "sq-restore";
    const file = h("input", { type: "file", accept: ".json,application/json", hidden: "", "aria-hidden": "true", tabindex: "-1", id: "sq-restore-file" });
    const conf = h("div", { class: "sq-conf-slot" });

    bk.addEventListener("click", () => {
      try {
        const blob = new Blob([JSON.stringify(makeBackup(guides), null, 1)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = h("a", { href: url, download: "study-quest-backup-" + ymd() + ".json", hidden: "" });
        doc.body.append(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
        say("Backup downloaded.", "ok");
      } catch (e) { say("Could not make the backup.", "bad"); }
    });
    rs.addEventListener("click", () => { conf.textContent = ""; say(""); file.value = ""; file.click(); });
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0];
      conf.textContent = ""; say("");
      if (!f) return;
      if (f.size > BACKUP_MAX) { say("That file is too big to be a backup (2 MB limit).", "bad"); return; }
      let j;
      try { j = JSON.parse(await f.text()); } catch (e) { say("That file could not be read as a backup.", "bad"); return; }
      const res = parseBackup(j, knownKeys(guides));
      if (res.error) { say(res.error, "bad"); return; }
      const n = res.guides;
      const yes = h("button", { type: "button", class: "sq-b pri" }, "Restore"), no = h("button", { type: "button", class: "sq-b" }, "Cancel");
      const box2 = h("div", { class: "sq-conf", role: "group", "aria-label": "Confirm restore" },
        "Replace the progress on this device with this backup (" + (n === 1 ? "1 guide" : n + " guides") + (res.items[PK] ? " and settings" : "") + ")? This cannot be undone.",
        h("div", { class: "sq-act" }, yes, no));
      conf.append(box2); no.focus();
      no.addEventListener("click", () => { conf.textContent = ""; rs.focus(); });
      yes.addEventListener("click", () => {
        yes.disabled = true; no.disabled = true;
        for (const k of Object.keys(res.items)) lsSet(k, JSON.stringify(res.items[k]));
        conf.textContent = ""; say("Progress restored. Reloading…", "ok");
        setTimeout(() => location.reload(), 500);
      });
    });

    set.append(mute, anim, bk, rs, file, conf, msg);
    box.append(set);

    function sync() {
      const p = prefs();
      mute.setAttribute("aria-checked", p.mute ? "true" : "false");
      ms.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.anim === p.anim ? "true" : "false"));
    }
    sync();
    const on = () => { if (!set.isConnected) { window.removeEventListener("sq-prefs", on); window.removeEventListener("storage", on); return; } sync(); };
    window.addEventListener("sq-prefs", on); window.addEventListener("storage", on);
    return set;
  }

  window.SQ_SHELL = Object.freeze({ prefs, setPrefs, applyClasses, modal, settings, checkUpdates, parseBackup, makeBackup, goodTime });

  /* ---------- suggestion box ---------- */
  let btn = null, enabled = false, dlgState = null;
  const GID = /^[a-z0-9-]{2,32}$/, QID = /^(?:s|ga|gd)\d{1,5}$/;
  const ownGuide = () => (window.GUIDE && typeof GUIDE.id === "string" && GID.test(GUIDE.id)) ? GUIDE.id : "hub";
  const pageName = () => { if (!window.GUIDE) return "hub"; const v = doc.body && doc.body.dataset && doc.body.dataset.view; return typeof v === "string" && /^[a-z0-9-]{1,30}$/.test(v) ? v : "home"; };

  function place() {
    if (!btn) return;
    const f = doc.getElementById("foot");
    if (f && !f.hidden && f.offsetHeight) btn.style.setProperty("--sq-sg-b", (f.offsetHeight + 12) + "px");
    else btn.style.removeProperty("--sq-sg-b");
  }
  function enable() {
    if (enabled) { place(); return; }
    enabled = true;
    btn = h("button", { type: "button", id: "sq-suggest", "aria-label": "Send a suggestion or report a problem", "aria-haspopup": "dialog", title: "Suggestions and problems" }, "💬");
    btn.addEventListener("click", () => open({}));
    doc.body.append(btn);
    place();
    addEventListener("resize", place);
    const f = doc.getElementById("foot");
    if (f && window.ResizeObserver) { try { new ResizeObserver(place).observe(f); } catch (e) { /* the resize listener is enough */ } }
    setTimeout(place, 300);
  }

  function open(o) {
    o = o && typeof o === "object" ? o : {};
    if (dlgState) { dlgState.close(); }
    const guide = typeof o.guide === "string" && GID.test(o.guide) ? o.guide : ownGuide();
    const qid = typeof o.qid === "string" && QID.test(o.qid) ? o.qid : null;
    const qtext = typeof o.qtext === "string" && o.qtext.trim() ? o.qtext.trim().slice(0, 500) : null;
    let kind = o.kind === "problem" ? "problem" : "idea", busy = false;
    const m = modal({ title: "", onClose: () => { dlgState = null; } });
    dlgState = m;
    const { dlg } = m;
    const intro = h("p", { class: "sq-mut", id: "sq-sg-d" }, "Tell Logan an idea for Study Quest, or report something that looks wrong. Only the owner reads these.");
    dlg.setAttribute("aria-describedby", "sq-sg-d");
    const seg = h("div", { class: "sq-seg", role: "radiogroup", "aria-label": "What are you sending?" });
    const radios = {};
    [["idea", "Suggestion"], ["problem", "Report a problem"]].forEach(([v, t]) => {
      const r = h("input", { type: "radio", name: "sq-kind", value: v }); radios[v] = r;
      if (v === kind) r.checked = true;
      seg.append(h("label", null, r, h("span", null, t)));
    });
    const ta = h("textarea", { class: "sq-ta", id: "sq-sg-body", maxlength: "1000", rows: "5", "aria-describedby": "sq-sg-count" });
    const count = h("div", { class: "sq-count", id: "sq-sg-count" }, "0 / 1000");
    const msg = h("div", { class: "sq-msg", id: "sq-sg-msg", role: "status", "aria-live": "polite" });
    const cancel = h("button", { type: "button", class: "sq-b", id: "sq-sg-cancel" }, "Cancel");
    const send = h("button", { type: "button", class: "sq-b pri", id: "sq-sg-send" }, "Send");
    const form = h("div", { class: "sq-form" }, seg);
    if (qtext) form.append(h("span", { class: "sq-lab" }, "About this question"), h("blockquote", { class: "sq-q", id: "sq-sg-q" }, qtext));
    form.append(h("label", { class: "sq-lab", for: "sq-sg-body", id: "sq-sg-lab" }, "Your message"), ta, count, msg, h("div", { class: "sq-act" }, cancel, send));
    dlg.append(intro, form);
    const retitle = () => {
      m.setTitle(kind === "problem" ? "Report a problem" : "Send a suggestion");
      ta.placeholder = kind === "problem" ? "What looks wrong? Say where you saw it." : "What would make Study Quest better?";
      doc.getElementById("sq-sg-lab").textContent = kind === "problem" ? "What went wrong?" : "Your suggestion";
    };
    retitle();
    const upd = () => { count.textContent = ta.value.length + " / 1000"; };
    ta.addEventListener("input", () => { upd(); if (msg.classList.contains("bad")) { msg.textContent = ""; msg.className = "sq-msg"; } });
    Object.keys(radios).forEach((v) => radios[v].addEventListener("change", () => { if (radios[v].checked) { kind = v; retitle(); } }));
    cancel.addEventListener("click", () => m.close());
    send.addEventListener("click", async () => {
      if (busy) return;
      const body = ta.value.trim();
      if (!body) { msg.className = "sq-msg bad"; msg.textContent = "Write a message first."; ta.focus(); return; }
      if (!(window.CSQ && typeof window.CSQ.suggest === "function")) { msg.className = "sq-msg bad"; msg.textContent = "Sending is not available right now. Try again later."; return; }
      busy = true; send.disabled = true; cancel.disabled = true; ta.readOnly = true; msg.className = "sq-msg"; msg.textContent = "Sending…";
      try {
        await window.CSQ.suggest({ kind, body: body.slice(0, 1000), guide, qid, qtext, page: pageName() });
        form.remove(); intro.remove();
        const done = h("button", { type: "button", class: "sq-b pri", id: "sq-sg-done" }, "Close");
        done.addEventListener("click", () => m.close());
        dlg.append(h("p", { class: "sq-msg ok", id: "sq-sg-thanks", role: "status" }, "Thank you! Your " + (kind === "problem" ? "report" : "suggestion") + " was sent."), h("div", { class: "sq-act" }, done));
        done.focus();
      } catch (e) {
        busy = false; send.disabled = false; cancel.disabled = false; ta.readOnly = false;
        const t = e && typeof e.message === "string" && e.message ? e.message.slice(0, 200) : "";
        msg.className = "sq-msg bad"; msg.textContent = t || "Could not send. Check your connection and try again.";
        send.focus();
      }
    });
    ta.focus();
    return m;
  }

  window.SQ_SUGGEST = Object.freeze({ open, enable });
})();
