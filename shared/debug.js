/* ===== Study Quest: admin debug panel =====
   Shown only when the signed-in person is the owner (CSQ.isOwner()) AND Debug mode is on (Settings, stored on this device as sq_debug).
   Measures: frames per second, slowest recent frame, long tasks (freezes), event-loop lag, server request times (from CSQ.net()),
   sync status, current view, page size (DOM nodes), memory, local storage used, page load time, script versions, device.
   Costs nothing when off: no loops run until the panel is shown, and everything stops when it is hidden. */
(function () {
  "use strict";
  const doc = document;
  const owner = () => { try { return !!(window.CSQ && window.CSQ.isOwner && window.CSQ.isOwner()); } catch (e) { return false; } };
  const wanted = () => { try { return localStorage.getItem("sq_debug") === "1"; } catch (e) { return false; } };

  let box = null, body = null, raf = 0, iv = 0, lagIv = 0, obs = null, collapsed = false;
  let frames = 0, fps = 0, lastSec = 0, lastF = 0, worst = [];          // worst: [time, ms] for the last 5 s
  let longs = [];                                                       // [time, ms] long tasks in the last 30 s
  let lags = [], lagLast = 0;                                           // [time, ms] timer drift in the last 5 s
  const LT = typeof PerformanceObserver === "function" && (PerformanceObserver.supportedEntryTypes || []).includes("longtask");

  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (lastF) { const d = t - lastF; worst.push([t, d]); }
    lastF = t; frames++;
    if (!lastSec) lastSec = t;
    if (t - lastSec >= 1000) { fps = Math.round(frames * 1000 / (t - lastSec)); frames = 0; lastSec = t; }
  }
  const keep = (arr, ms) => { const c = performance.now() - ms; while (arr.length && arr[0][0] < c) arr.shift(); };
  const max = (arr) => arr.reduce((m, x) => Math.max(m, x[1]), 0);
  const kb = (n) => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";

  function storageSize() { let n = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (e) { /* blocked */ } return n; }
  function versions() {
    const out = [];
    doc.querySelectorAll("script[src],link[rel=stylesheet][href]").forEach((el) => {
      const u = el.getAttribute("src") || el.getAttribute("href") || ""; const m = u.match(/([a-z0-9-]+\.(?:js|css))\?v=(\d+)/i);
      if (m) out.push(m[1].replace(/\.(js|css)$/, "") + " " + m[2]);
    });
    return [...new Set(out)].join(" · ");
  }
  function loadMs() { try { const n = performance.getEntriesByType("navigation")[0]; return n ? Math.round(n.loadEventEnd || n.domContentLoadedEventEnd || n.duration) : 0; } catch (e) { return 0; } }

  function snapshot() {
    keep(worst, 5000); keep(longs, 30000); keep(lags, 5000);
    const net = (window.CSQ && typeof window.CSQ.net === "function") ? window.CSQ.net() : [];
    const last10 = net.slice(-10), done = last10.filter((x) => x.st > 0);
    const avg = done.length ? Math.round(done.reduce((a, x) => a + x.ms, 0) / done.length) : 0;
    const slow = net.reduce((a, x) => (!a || x.ms > a.ms ? x : a), null);
    const errs = net.filter((x) => x.st === 0 || x.st >= 400).length;
    const last = net[net.length - 1];
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB" : "n/a";
    const conn = navigator.connection ? (navigator.connection.effectiveType || "") + (navigator.connection.rtt ? " ~" + navigator.connection.rtt + " ms" : "") : "n/a";
    let sync = "n/a"; try { if (window.CSQ_SYNC && typeof window.CSQ_SYNC.text === "function") sync = window.CSQ_SYNC.text(); } catch (e) { /* */ }
    return {
      fps, worstFrame: Math.round(max(worst)), longTasks30s: LT ? longs.length : "n/a", longestTask: LT ? Math.round(max(longs)) : "n/a",
      lag: Math.round(max(lags)), lastReq: last ? last.m + " " + last.p.replace(/^\/(rest|auth|storage|functions)\/v1\//, "") + " " + last.ms + " ms" + (last.st && last.st < 400 ? "" : " (" + (last.st || "failed") + ")") : "none yet",
      avgReq: avg, slowReq: slow ? slow.p.replace(/^\/(rest|auth|storage|functions)\/v1\//, "") + " " + slow.ms + " ms" : "none", reqErrors: errs, reqCount: net.length,
      sync, view: (doc.body && doc.body.dataset.view) || "-", page: location.pathname.replace(/^.*\/study-quest/, "") || "/",
      dom: doc.getElementsByTagName("*").length, mem, storage: kb(storageSize()), load: loadMs(), versions: versions(),
      device: innerWidth + "×" + innerHeight + " @" + (devicePixelRatio || 1) + "x", conn, time: new Date().toISOString()
    };
  }
  const grade = (v, good, ok) => v >= good ? "good" : v >= ok ? "ok" : "bad";
  const gradeLow = (v, good, ok) => v <= good ? "good" : v <= ok ? "ok" : "bad";
  const WORD = { good: "", ok: " (slow)", bad: " (bad)" };

  function paint() {
    if (!body) return;
    const s = snapshot();
    const rows = [
      ["FPS", s.fps, grade(s.fps, 50, 30)],
      ["Worst frame (5 s)", s.worstFrame + " ms", gradeLow(s.worstFrame, 50, 100)],
      ["Freezes (30 s)", s.longTasks30s === "n/a" ? "n/a" : s.longTasks30s + (s.longTasks30s ? ", longest " + s.longestTask + " ms" : ""), s.longTasks30s === "n/a" ? "" : gradeLow(s.longestTask, 50, 200)],
      ["Event-loop lag", s.lag + " ms", gradeLow(s.lag, 30, 100)],
      ["Last request", s.lastReq, ""],
      ["Avg request (10)", s.avgReq ? s.avgReq + " ms" : "-", s.avgReq ? gradeLow(s.avgReq, 300, 1000) : ""],
      ["Slowest request", s.slowReq, ""],
      ["Request errors", s.reqErrors + " of " + s.reqCount, s.reqErrors ? "bad" : ""],
      ["Sync", s.sync, ""],
      ["View", s.page + (s.view !== "-" ? " · " + s.view : ""), ""],
      ["DOM nodes", s.dom, gradeLow(s.dom, 1500, 4000)],
      ["Memory", s.mem, ""],
      ["Local storage", s.storage, ""],
      ["Page load", s.load ? s.load + " ms" : "-", s.load ? gradeLow(s.load, 2000, 5000) : ""],
      ["Device", s.device + " · " + s.conn, ""],
      ["Versions", s.versions, ""]
    ];
    const head = box.querySelector(".sq-dbg-h b");
    head.textContent = "🛠 Debug · " + s.fps + " fps";
    body.textContent = "";
    for (const [k, v, g] of rows) {
      const r = doc.createElement("div"); r.className = "sq-dbg-r" + (g ? " " + g : "");
      const a = doc.createElement("span"); a.textContent = k;
      const b = doc.createElement("span"); b.textContent = String(v) + (g && WORD[g] ? WORD[g] : "");
      r.append(a, b); body.append(r);
    }
  }

  function css() {
    if (doc.getElementById("sq-dbg-css")) return;
    const st = doc.createElement("style"); st.id = "sq-dbg-css";
    st.textContent = "#sq-dbg{position:fixed;left:max(8px,env(safe-area-inset-left,0px));bottom:max(8px,env(safe-area-inset-bottom,0px));z-index:95;width:min(330px,calc(100vw - 16px));max-height:60vh;overflow:auto;background:rgba(8,12,20,.9);color:#f2f5f8;border:1px solid rgba(255,255,255,.25);border-radius:12px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 8px 30px rgba(0,0,0,.4)}"
      + "#sq-dbg .sq-dbg-h{display:flex;align-items:center;gap:6px;padding:6px 8px;position:sticky;top:0;background:rgba(8,12,20,.96)}#sq-dbg .sq-dbg-h b{flex:1;font-weight:700}"
      + "#sq-dbg button{appearance:none;min-width:30px;min-height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.35);background:#1b2433;color:#f2f5f8;font:inherit;cursor:pointer;padding:0 8px}#sq-dbg button:focus-visible{outline:3px solid #7cc4ff;outline-offset:1px}"
      + "#sq-dbg .sq-dbg-b{padding:2px 8px 8px}#sq-dbg .sq-dbg-r{display:flex;justify-content:space-between;gap:10px;padding:2px 0;border-top:1px solid rgba(255,255,255,.08)}#sq-dbg .sq-dbg-r span:last-child{text-align:right;overflow-wrap:anywhere}"
      + "#sq-dbg .good span:last-child{color:#7ee2a8}#sq-dbg .ok span:last-child{color:#ffd166}#sq-dbg .bad span:last-child{color:#ff8f8f}#sq-dbg.col .sq-dbg-b{display:none}#sq-dbg.col{width:auto;max-width:calc(100vw - 16px)}";
    doc.head.append(st);
  }

  function show() {
    if (box) return;
    css();
    box = doc.createElement("div"); box.id = "sq-dbg"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Debug panel (admin only)");
    const h = doc.createElement("div"); h.className = "sq-dbg-h";
    const t = doc.createElement("b"); t.textContent = "🛠 Debug";
    const cp = doc.createElement("button"); cp.type = "button"; cp.textContent = "Copy"; cp.setAttribute("aria-label", "Copy a debug report");
    const mn = doc.createElement("button"); mn.type = "button"; mn.textContent = "–"; mn.setAttribute("aria-label", "Collapse the debug panel"); mn.setAttribute("aria-expanded", "true");
    const x = doc.createElement("button"); x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Turn debug mode off");
    h.append(t, cp, mn, x);
    body = doc.createElement("div"); body.className = "sq-dbg-b";
    box.append(h, body); doc.body.append(box);
    const setCol = (c) => { collapsed = c; box.classList.toggle("col", c); mn.textContent = c ? "+" : "–"; mn.setAttribute("aria-expanded", c ? "false" : "true"); mn.setAttribute("aria-label", c ? "Expand the debug panel" : "Collapse the debug panel"); };
    setCol(innerWidth < 600); /* phones start as a small bar (title + FPS); tap + for the details */
    cp.addEventListener("click", async () => {
      const txt = JSON.stringify(Object.assign(snapshot(), { requests: (window.CSQ && window.CSQ.net ? window.CSQ.net() : []) }), null, 1);
      try { await navigator.clipboard.writeText(txt); cp.textContent = "Copied"; } catch (e) { cp.textContent = "Copy failed"; }
      setTimeout(() => { cp.textContent = "Copy"; }, 1500);
    });
    mn.addEventListener("click", () => setCol(!collapsed));
    x.addEventListener("click", () => { try { localStorage.setItem("sq_debug", "0"); } catch (e) { /* */ } window.dispatchEvent(new Event("sq-debug")); });
    frames = 0; lastSec = 0; lastF = 0; worst = []; lags = []; lagLast = performance.now();
    raf = requestAnimationFrame(frame);
    lagIv = setInterval(() => { const n = performance.now(); lags.push([n, Math.max(0, n - lagLast - 250)]); lagLast = n; }, 250);
    if (LT) { try { obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) longs.push([e.startTime + e.duration, e.duration]); }); obs.observe({ type: "longtask", buffered: true }); } catch (e) { obs = null; } }
    paint(); iv = setInterval(paint, 500);
  }
  function hide() {
    cancelAnimationFrame(raf); clearInterval(iv); clearInterval(lagIv); raf = iv = lagIv = 0;
    if (obs) { try { obs.disconnect(); } catch (e) { /* */ } obs = null; }
    if (box) box.remove(); box = body = null;
  }
  function apply() { if (owner() && wanted() && !doc.hidden) show(); else hide(); }

  window.addEventListener("sq-debug", apply);
  window.addEventListener("storage", (e) => { if (e.key === "sq_debug" || e.key === null) apply(); });
  doc.addEventListener("visibilitychange", apply);
  /* the owner is known only after sign-in finishes: check for up to a minute after load */
  let tries = 0; const wait = setInterval(() => { tries++; if (owner() || tries > 60) { clearInterval(wait); apply(); } }, 1000);
  if (doc.readyState !== "loading") apply(); else doc.addEventListener("DOMContentLoaded", apply);
})();
