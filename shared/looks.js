/* Per-guide visual looks for the Study Quest engine (plain JS, no dependencies).
   A guide opts in with `look: "origins"`, `"cosmos"` or `"chalk"` in its guide.js (window.GUIDE). The guide page itself carries the CSS
   variable overrides (colors, heading font); this file supplies what CSS cannot: the logo, the animated background, the
   colour-theme picker options and the level titles. A guide without a look (CS 379) never loads this file and uses the
   built-in cyber look in app.js. Everything here respects prefers-reduced-motion (one still frame, no animation loop). */
(function () {
  "use strict";
  const TAU = Math.PI * 2, rnd = Math.random;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mq = (q) => { try { return matchMedia(q); } catch (e) { return { matches: false }; } };
  const G = () => window.GUIDE || {};
  const isDark = () => {
    const t = document.documentElement.dataset.theme;
    if (t) return t === "dark";
    const d = G().defaultTheme;
    return d ? d === "dark" : mq("(prefers-color-scheme: dark)").matches;
  };
  const netColor = (fallback) => getComputedStyle(document.documentElement).getPropertyValue("--net").trim() || fallback;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const hsl2rgb = (h, s, l) => {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)).join(",");
  };

  /* ---------- logo scaffolding: gradient + optional pulse rings ---------- */
  function wrap(u, sz, big, label, body) {
    const a11y = label ? 'role="img" aria-label="' + esc(label) + '"' : 'aria-hidden="true"';
    return '<svg class="logo" viewBox="0 0 64 64" width="' + sz + '" height="' + sz + '" ' + a11y + ' style="color:var(--ac);overflow:visible">'
      + '<defs><linearGradient id="' + u + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ac)"/><stop offset="1" style="stop-color:var(--ac2)"/></linearGradient></defs>'
      + (big ? '<circle class="ringp" cx="32" cy="32" r="34" fill="none" stroke="url(#' + u + 'g)" stroke-width="1.2"/><circle class="ringp r2" cx="32" cy="32" r="34" fill="none" stroke="url(#' + u + 'g)" stroke-width="1.2"/>' : "")
      + body + "</svg>";
  }
  const spark = (cls, x, y, r) => '<path class="' + cls + '" d="M' + x + " " + (y - r) + "l" + r * 0.3 + " " + r * 0.7 + "l" + r * 0.7 + " " + r * 0.3 + "l" + -r * 0.7 + " " + r * 0.3 + "l" + -r * 0.3 + " " + r * 0.7 + "l" + -r * 0.3 + " " + -r * 0.7 + "l" + -r * 0.7 + " " + -r * 0.3 + "l" + r * 0.7 + " " + -r * 0.3 + 'z" style="fill:var(--ac2)"/>';

  /* ---------- a generic soft-light background loop with reduced-motion handling ---------- */
  function loop(cv, name, setup, frame) {
    const cx = cv.getContext && cv.getContext("2d"); if (!cx) return;
    const st = { W: 0, H: 0, dpr: 1, last: 0, raf: 0 };
    function size() {
      st.dpr = Math.min(devicePixelRatio || 1, 1.5); st.W = innerWidth; st.H = innerHeight;
      cv.width = Math.round(st.W * st.dpr); cv.height = Math.round(st.H * st.dpr); cx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      setup(st);
    }
    function tick(t) {
      st.raf = requestAnimationFrame(tick);
      if (t - st.last < 33) return; st.last = t;
      frame(cx, st, t, false);
    }
    function start() {
      cancelAnimationFrame(st.raf);
      if (mq("(prefers-reduced-motion: reduce)").matches) { cv.dataset.anim = "static"; frame(cx, st, 4000, true); }
      else { cv.dataset.anim = "running"; st.raf = requestAnimationFrame(tick); }
    }
    cv.dataset.look = name;
    size(); start();
    addEventListener("resize", () => { size(); if (cv.dataset.anim === "static") frame(cx, st, 4000, true); });
    const m = mq("(prefers-reduced-motion: reduce)"); if (m.addEventListener) m.addEventListener("change", start);
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(st.raf); else start(); });
    try { new MutationObserver(() => { if (cv.dataset.anim === "static") frame(cx, st, 4000, true); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style"] }); } catch (e) { /* older browsers: the still frame refreshes on the next resize */ }
  }

  /* ================= ORIGINS: parchment, olive and gold; drifting light rays, floating leaves and sparks of light ================= */
  const origins = {
    meta: { light: "#f4ecd8", dark: "#15130b" },
    titles: ["Seeker", "Gardener", "Student of Genesis", "Kind Keeper", "Day Counter", "Flood Watcher", "Apologist", "Scholar of Origins", "Steward of Creation", "Faithful Witness"],
    palettes: [["olive", "Olive and gold", 52], ["sage", "Sage", 140], ["clay", "Terracotta", 18], ["water", "Still water", 200], ["wine", "Vineyard", 340], ["dawn", "Sunrise", 36]],
    swatch: (h) => "linear-gradient(135deg,hsl(" + h + " 55% 42%),hsl(" + ((h + 30) % 360) + " 65% 58%))",
    gen(h, d) {
      const h2 = (h + 34) % 360;
      return d
        ? { "--bg": `hsl(${h} 32% 7%)`, "--bg2": `hsl(${h} 28% 11%)`, "--card": `hsl(${h} 26% 14%)`, "--cardA": `hsl(${h} 26% 14% / .88)`, "--tx": `hsl(${h} 40% 92%)`, "--mut": `hsl(${h} 22% 70%)`, "--ac": `hsl(${h} 62% 62%)`, "--ac2": `hsl(${h2} 55% 68%)`, "--bd": `hsl(${h} 24% 22%)`, "--glow": `hsl(${h} 62% 62% / .28)`, "--net": hsl2rgb(h, 62, 62), "--bt": `hsl(${h} 40% 8%)` }
        : { "--bg": `hsl(${h} 40% 92%)`, "--bg2": `hsl(${h} 36% 87%)`, "--card": `hsl(${h} 50% 98%)`, "--cardA": `hsl(${h} 50% 98% / .9)`, "--tx": `hsl(${h} 45% 11%)`, "--mut": `hsl(${h} 20% 30%)`, "--ac": `hsl(${h} 66% 24%)`, "--ac2": `hsl(${h2} 70% 26%)`, "--bd": `hsl(${h} 30% 80%)`, "--glow": `hsl(${h} 66% 24% / .24)`, "--net": hsl2rgb(h, 66, 24), "--bt": `hsl(${h} 50% 98%)` };
    },
    /* open book with a small tree growing from the spine (the tree of kinds) */
    logo(u, sz, big, label) {
      const pg = 'style="fill:rgba(var(--net),.14)" stroke="url(#' + u + 'g)" stroke-width="3" stroke-linejoin="round"';
      return wrap(u, sz, big, label,
        '<path d="M32 56C26 52 16 51 7 53V31C16 29 26 30 32 35Z" ' + pg + "/>"
        + '<path d="M32 56C38 52 48 51 57 53V31C48 29 38 30 32 35Z" ' + pg + "/>"
        + '<path d="M13 38C18 37 23 38 27 40M13 44C18 43 23 44 27 46M37 40C41 38 46 37 51 38M37 46C41 44 46 43 51 44" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round"/>'
        + '<path d="M32 36V19" fill="none" stroke="url(#' + u + 'g)" stroke-width="2.6" stroke-linecap="round"/>'
        + '<g class="lf-sway"><ellipse cx="32" cy="12" rx="5.5" ry="8" fill="url(#' + u + 'g)"/><ellipse cx="23.5" cy="22" rx="4" ry="7" transform="rotate(-50 23.5 22)" fill="url(#' + u + 'g)" opacity=".9"/><ellipse cx="40.5" cy="22" rx="4" ry="7" transform="rotate(50 40.5 22)" fill="url(#' + u + 'g)" opacity=".9"/></g>'
        + spark("blip", 53, 11, 5));
    },
    logoDesc: "an open book with a small tree growing from its spine",
    bg(cv) {
      let P = [];
      const mote = (init, W, H) => {
        const leaf = rnd() < 0.4;
        return { leaf, x: rnd() * W, y: init ? rnd() * H : H + 24, s: leaf ? 5 + rnd() * 5 : 1.2 + rnd() * 2, vy: 0.12 + rnd() * 0.22, ph: rnd() * TAU, sw: 0.5 + rnd() * 0.7, amp: 10 + rnd() * 26, rot: rnd() * TAU, rv: (rnd() - 0.5) * 0.012, tw: rnd() * TAU, a: 0.4 + rnd() * 0.5 };
      };
      loop(cv, "origins",
        (s) => { const n = clamp(Math.round(s.W * s.H / 30000), 14, 34); P = []; for (let i = 0; i < n; i++) P.push(mote(true, s.W, s.H)); },
        (cx, s, t, still) => {
          const W = s.W, H = s.H, c = netColor("122,134,52"), dark = isDark();
          cx.clearRect(0, 0, W, H);
          /* warm glow in the top corner */
          const g = cx.createRadialGradient(W * 0.1, -30, 0, W * 0.1, -30, Math.max(W, H) * 0.85);
          g.addColorStop(0, "rgba(" + c + "," + (dark ? 0.16 : 0.2) + ")"); g.addColorStop(1, "rgba(" + c + ",0)"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
          /* three slowly swaying beams of light, each three nested trapezoids so the edges stay soft */
          for (let k = 0; k < 3; k++) {
            const x0 = W * (0.12 + 0.3 * k) + Math.sin(t / 7000 + k * 2) * 36, ang = 0.32 + Math.sin(t / 9000 + k * 1.7) * 0.05, a = (dark ? 0.06 : 0.09) * (0.75 + 0.25 * Math.sin(t / 5000 + k));
            cx.save(); cx.translate(x0, -20); cx.rotate(-ang);
            const gr = cx.createLinearGradient(0, 0, 0, H * 1.25); gr.addColorStop(0, "rgba(" + c + "," + a + ")"); gr.addColorStop(1, "rgba(" + c + ",0)"); cx.fillStyle = gr;
            for (const f of [1, 0.66, 0.36]) { const w0 = 30 * f, w1 = (150 + 40 * k) * f; cx.beginPath(); cx.moveTo(-w0, 0); cx.lineTo(w0, 0); cx.lineTo(w1, H * 1.25); cx.lineTo(-w1, H * 1.25); cx.closePath(); cx.fill(); }
            cx.restore();
          }
          /* leaves and sparks of light drifting upward */
          for (const m of P) {
            if (!still) { m.y -= m.vy; m.rot += m.rv; if (m.y < -30) Object.assign(m, mote(false, W, H)); }
            const x = m.x + Math.sin(t / 1000 * m.sw + m.ph) * m.amp, al = m.a * (0.6 + 0.4 * Math.sin(t / 700 + m.tw));
            if (m.leaf) {
              cx.save(); cx.translate(x, m.y); cx.rotate(m.rot); cx.fillStyle = "rgba(" + c + "," + al * (dark ? 0.55 : 0.45) + ")";
              cx.beginPath(); cx.moveTo(0, -m.s); cx.quadraticCurveTo(m.s * 0.8, -m.s * 0.1, 0, m.s); cx.quadraticCurveTo(-m.s * 0.8, -m.s * 0.1, 0, -m.s); cx.fill(); cx.restore();
            } else {
              cx.fillStyle = "rgba(" + c + "," + al * (dark ? 0.2 : 0.16) + ")"; cx.beginPath(); cx.arc(x, m.y, m.s * 3, 0, TAU); cx.fill();
              cx.fillStyle = "rgba(" + c + "," + al * (dark ? 0.85 : 0.6) + ")"; cx.beginPath(); cx.arc(x, m.y, m.s * 0.8, 0, TAU); cx.fill();
            }
          }
        });
    }
  };

  /* ================= COSMOS: deep space and dawn sky; twinkling starfield and an occasional faint shooting star ================= */
  const cosmos = {
    meta: { light: "#f3eefb", dark: "#05061a" },
    titles: ["Sky Gazer", "Moon Watcher", "Constellation Finder", "Planet Spotter", "Comet Chaser", "Telescope Operator", "Orbit Calculator", "Nebula Mapper", "Galaxy Guide", "Cosmic Navigator"],
    palettes: [["nebula", "Nebula violet", 262], ["aurora", "Aurora green", 160], ["pulsar", "Pulsar blue", 212], ["mars", "Mars red", 8], ["nova", "Nova pink", 320], ["solar", "Solar gold", 42]],
    swatch: (h) => "linear-gradient(135deg,hsl(" + h + " 85% 58%),hsl(" + ((h + 40) % 360) + " 85% 68%))",
    gen(h, d) {
      const h2 = (h + 40) % 360;
      return d
        ? { "--bg": `hsl(${h} 60% 5%)`, "--bg2": `hsl(${h} 55% 9%)`, "--card": `hsl(${h} 50% 12%)`, "--cardA": `hsl(${h} 50% 12% / .86)`, "--tx": `hsl(${h} 60% 96%)`, "--mut": `hsl(${h} 28% 72%)`, "--ac": `hsl(${h} 90% 74%)`, "--ac2": `hsl(${h2} 90% 78%)`, "--bd": `hsl(${h} 45% 20%)`, "--glow": `hsl(${h} 90% 74% / .3)`, "--net": hsl2rgb(h, 90, 74), "--bt": `hsl(${h} 60% 8%)` }
        : { "--bg": `hsl(${h} 60% 96%)`, "--bg2": `hsl(${h} 50% 92%)`, "--card": "#fff", "--cardA": "rgba(255,255,255,.88)", "--tx": `hsl(${h} 55% 13%)`, "--mut": `hsl(${h} 22% 33%)`, "--ac": `hsl(${h} 80% 25%)`, "--ac2": `hsl(${h2} 76% 26%)`, "--bd": `hsl(${h} 35% 85%)`, "--glow": `hsl(${h} 80% 25% / .22)`, "--net": hsl2rgb(h, 80, 25), "--bt": "#fff" };
    },
    /* ringed planet with twinkling stars */
    logo(u, sz, big, label) {
      return wrap(u, sz, big, label,
        '<g class="orb">'
        + '<g transform="rotate(-20 32 32)"><path d="M5 32A27 8.5 0 0 1 59 32" fill="none" stroke="url(#' + u + 'g)" stroke-width="3" stroke-linecap="round" stroke-opacity=".6"/></g>'
        + '<circle cx="32" cy="32" r="13.5" style="fill:rgba(var(--net),.16)" stroke="url(#' + u + 'g)" stroke-width="3"/>'
        + '<path d="M23 28.5C27 25.5 35 25 41 27.5M22.5 35C28 33 36 33.5 41.5 36" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.4" stroke-linecap="round"/>'
        + '<g transform="rotate(-20 32 32)"><path d="M5 32A27 8.5 0 0 0 59 32" fill="none" stroke="url(#' + u + 'g)" stroke-width="3" stroke-linecap="round"/></g>'
        + "</g>"
        + spark("blip", 11, 12, 5) + spark("blip b2", 54, 52, 4) + '<circle class="blip b3" cx="52" cy="11" r="1.8" style="fill:var(--ac)"/>');
    },
    logoDesc: "a ringed planet with twinkling stars",
    bg(cv) {
      let S = [], shoot = null, nextAt = 0;
      loop(cv, "cosmos",
        (s) => {
          const n = clamp(Math.round(s.W * s.H / 5200), 80, 240); S = [];
          for (let i = 0; i < n; i++) { const r = 0.4 + Math.pow(rnd(), 3) * 1.7; S.push({ x: rnd() * s.W, y: rnd() * s.H, r, ph: rnd() * TAU, sp: 0.5 + rnd() * 2.2, a: 0.35 + rnd() * 0.6 }); }
          shoot = null; nextAt = 2500 + rnd() * 5000;
        },
        (cx, s, t, still) => {
          const W = s.W, H = s.H, c = netColor("167,139,250"), dark = isDark();
          cx.clearRect(0, 0, W, H);
          if (dark) {
            const a = cx.createRadialGradient(W * 0.82, H * 0.18 + Math.sin(t / 12000) * 20, 0, W * 0.82, H * 0.18, Math.max(W, H) * 0.65); a.addColorStop(0, "rgba(" + c + ",.13)"); a.addColorStop(1, "rgba(" + c + ",0)"); cx.fillStyle = a; cx.fillRect(0, 0, W, H);
            const b = cx.createRadialGradient(W * 0.08, H * 0.9, 0, W * 0.08, H * 0.9, Math.max(W, H) * 0.55); b.addColorStop(0, "rgba(56,120,255,.09)"); b.addColorStop(1, "rgba(56,120,255,0)"); cx.fillStyle = b; cx.fillRect(0, 0, W, H);
          } else {
            /* dawn: a warm horizon glow under a lavender sky */
            const a = cx.createRadialGradient(W * 0.5, H * 1.08, 0, W * 0.5, H * 1.08, Math.max(W, H) * 0.95); a.addColorStop(0, "rgba(255,160,110,.30)"); a.addColorStop(0.55, "rgba(255,190,170,.12)"); a.addColorStop(1, "rgba(255,190,170,0)"); cx.fillStyle = a; cx.fillRect(0, 0, W, H);
            const b = cx.createRadialGradient(W * 0.2, -20, 0, W * 0.2, -20, Math.max(W, H) * 0.7); b.addColorStop(0, "rgba(" + c + ",.12)"); b.addColorStop(1, "rgba(" + c + ",0)"); cx.fillStyle = b; cx.fillRect(0, 0, W, H);
          }
          for (const q of S) {
            const al = q.a * (0.55 + 0.45 * Math.sin(t / 1000 * q.sp + q.ph));
            cx.fillStyle = dark ? "rgba(236,235,255," + al + ")" : "rgba(" + c + "," + al * 0.4 + ")";
            cx.beginPath(); cx.arc(q.x, q.y, q.r, 0, TAU); cx.fill();
            if (q.r > 1.3) { cx.strokeStyle = dark ? "rgba(236,235,255," + al * 0.45 + ")" : "rgba(" + c + "," + al * 0.25 + ")"; cx.lineWidth = 0.7; cx.beginPath(); cx.moveTo(q.x - q.r * 4, q.y); cx.lineTo(q.x + q.r * 4, q.y); cx.moveTo(q.x, q.y - q.r * 4); cx.lineTo(q.x, q.y + q.r * 4); cx.stroke(); }
          }
          if (still) return;
          if (!shoot && t >= nextAt) {
            const ang = Math.PI * (0.14 + rnd() * 0.12);
            shoot = { x: W * (0.1 + rnd() * 0.6), y: H * (0.04 + rnd() * 0.3), dx: Math.cos(ang), dy: Math.sin(ang), v: 0.55 + rnd() * 0.25, len: 90 + rnd() * 80, t0: t, life: 1100 };
          }
          if (shoot) {
            const age = t - shoot.t0;
            if (age > shoot.life) { shoot = null; nextAt = t + 7000 + rnd() * 9000; }
            else {
              const d = age * shoot.v, hx = shoot.x + shoot.dx * d, hy = shoot.y + shoot.dy * d, f = 1 - age / shoot.life, tx = hx - shoot.dx * shoot.len, ty = hy - shoot.dy * shoot.len;
              const gr = cx.createLinearGradient(tx, ty, hx, hy), col = dark ? "236,235,255" : c;
              gr.addColorStop(0, "rgba(" + col + ",0)"); gr.addColorStop(1, "rgba(" + col + "," + (dark ? 0.7 : 0.45) * f + ")");
              cx.strokeStyle = gr; cx.lineWidth = 1.5; cx.lineCap = "round"; cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(hx, hy); cx.stroke();
            }
          }
        });
    }
  };

  /* ================= CHALK: a green chalkboard (dark) and graph paper (light); faint chalk math symbols drift over a faint grid ================= */
  const chalk = {
    meta: { light: "#f6f8fc", dark: "#14261f" },
    titles: ["Counting Novice", "Sequence Spotter", "Set Builder", "Function Mapper", "Induction Apprentice", "Basis Prover", "Proof Writer", "Element Chaser", "Inverse Finder", "Bijection Master", "Theorem Prover"],
    /* the first palette is the stylesheet's own colours; 999 marks the low-saturation graphite palette */
    palettes: [["chalk", "Chalk green", 150], ["blueprint", "Blueprint", 214], ["ink", "Ink violet", 262], ["redpen", "Red pen", 4], ["marker", "Highlighter", 52], ["graphite", "Graphite", 999]],
    swatch: (h) => h === 999 ? "linear-gradient(135deg,hsl(215 8% 38%),hsl(215 8% 66%))" : "linear-gradient(135deg,hsl(" + h + " 70% 50%),hsl(" + ((h + 150) % 360) + " 65% 62%))",
    gen(h, d) {
      const g = h === 999, hh = g ? 215 : h, h2 = (hh + 150) % 360, s = g ? 0.25 : 1;
      return d
        ? { "--bg": `hsl(${hh} ${30 * s}% 9%)`, "--bg2": `hsl(${hh} ${28 * s}% 13%)`, "--card": `hsl(${hh} ${26 * s}% 17%)`, "--cardA": `hsl(${hh} ${26 * s}% 17% / .9)`, "--tx": `hsl(${hh} ${25 * s}% 94%)`, "--mut": `hsl(${hh} ${16 * s}% 76%)`, "--ac": `hsl(${hh} ${82 * s}% 72%)`, "--ac2": `hsl(${h2} ${70 * s}% 76%)`, "--bd": `hsl(${hh} ${22 * s}% 26%)`, "--glow": `hsl(${hh} ${82 * s}% 72% / .26)`, "--net": hsl2rgb(hh, 14 * s, 90), "--bt": `hsl(${hh} ${40 * s}% 7%)` }
        : { "--bg": `hsl(${hh} ${50 * s}% 97%)`, "--bg2": `hsl(${hh} ${40 * s}% 93%)`, "--card": "#fff", "--cardA": "rgba(255,255,255,.9)", "--tx": `hsl(${hh} ${45 * s}% 13%)`, "--mut": `hsl(${hh} ${22 * s}% 31%)`, "--ac": `hsl(${hh} ${75 * s}% 24%)`, "--ac2": `hsl(${h2} ${68 * s}% 24%)`, "--bd": `hsl(${hh} ${34 * s}% 83%)`, "--glow": `hsl(${hh} ${75 * s}% 24% / .22)`, "--net": hsl2rgb(hh, 75 * s, 24), "--bt": "#fff" };
    },
    /* a chalk-drawn square with a sigma, a little dust and a tick mark */
    logo(u, sz, big, label) {
      return wrap(u, sz, big, label,
        '<g class="chalk-wob">'
        + '<path d="M13 9.5C25 8 40 9 51 8.5C55 8.5 56 10 55.6 14C56.4 26 55 40 55.4 51C55.5 55 54 56 50 55.7C38 56.6 24 55 13.5 55.6C9.5 55.7 8.6 54 8.8 50C8 38 9.2 25 8.6 14C8.5 10.5 10 9.6 13 9.5Z" style="fill:rgba(var(--net),.1)" stroke="url(#' + u + 'g)" stroke-width="3" stroke-linejoin="round"/>'
        + '<path d="M41.5 19.5H23L33.5 32L23 44.5H42" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M14 49.5L17 52.5L22 46.5" fill="none" stroke="var(--ac2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>'
        + "</g>"
        + spark("blip", 54, 10, 5) + '<circle class="blip b2" cx="10" cy="14" r="1.6" style="fill:var(--ac2)"/><circle class="blip b3" cx="57" cy="50" r="1.4" style="fill:var(--ac)"/>');
    },
    logoDesc: "a chalk-drawn square with a sigma",
    bg(cv) {
      const SYM = ["Σ", "∀", "∃", "∈", "⊆", "∪", "∩", "⇒", "∘", "ℤ", "n+1", "∅", "f⁻¹", "≤", "∑ k", "P(k)", "Π", "⌊x⌋"];
      let P = [];
      const mk = (init, W, H) => ({ ch: SYM[(rnd() * SYM.length) | 0], x: rnd() * W, y: init ? rnd() * H : H + 40, sz: 16 + rnd() * 26, vy: 0.05 + rnd() * 0.12, vx: (rnd() - 0.5) * 0.05, rot: (rnd() - 0.5) * 0.5, rv: (rnd() - 0.5) * 0.0006, a: 0.5 + rnd() * 0.5, ph: rnd() * TAU });
      loop(cv, "chalk",
        (s) => { const n = clamp(Math.round(s.W * s.H / 42000), 10, 30); P = []; for (let i = 0; i < n; i++) P.push(mk(true, s.W, s.H)); },
        (cx, s, t, still) => {
          const W = s.W, H = s.H, c = netColor("236,240,226"), dark = isDark(), step = 36;
          cx.clearRect(0, 0, W, H);
          /* soft light across the board (dark) or the page (light) */
          const g = cx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.max(W, H) * 0.8);
          g.addColorStop(0, "rgba(" + c + "," + (dark ? 0.06 : 0.05) + ")"); g.addColorStop(1, "rgba(" + c + ",0)"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
          /* very faint grid, every fifth line a little stronger; it creeps slowly sideways */
          const off = still ? 0 : (t / 1000 * 1.2) % (step * 5);
          cx.lineWidth = 1;
          for (let i = -5; i * step - off < W + step * 5; i++) {
            const x = Math.round(i * step - off) + 0.5; if (x < -2 || x > W + 2) continue;
            cx.strokeStyle = "rgba(" + c + "," + (i % 5 === 0 ? (dark ? 0.065 : 0.12) : (dark ? 0.035 : 0.06)) + ")";
            cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke();
          }
          for (let j = 0; j * step < H + step; j++) {
            const y = Math.round(j * step) + 0.5;
            cx.strokeStyle = "rgba(" + c + "," + (j % 5 === 0 ? (dark ? 0.065 : 0.12) : (dark ? 0.035 : 0.06)) + ")";
            cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke();
          }
          /* chalk symbols drifting up */
          cx.textAlign = "center"; cx.textBaseline = "middle";
          for (const m of P) {
            if (!still) { m.y -= m.vy; m.x += m.vx; m.rot += m.rv; if (m.y < -50) Object.assign(m, mk(false, W, H)); }
            const al = m.a * (0.8 + 0.2 * Math.sin(t / 2500 + m.ph)) * (dark ? 0.15 : 0.12);
            cx.save(); cx.translate(m.x, m.y); cx.rotate(m.rot);
            cx.font = "italic " + Math.round(m.sz) + 'px Georgia,"Times New Roman",serif';
            cx.fillStyle = "rgba(" + c + "," + al + ")"; cx.fillText(m.ch, 0, 0);
            cx.restore();
          }
        });
    }
  };

  window.CSQ_LOOKS = Object.freeze({ origins: Object.freeze(origins), cosmos: Object.freeze(cosmos), chalk: Object.freeze(chalk) });
})();
