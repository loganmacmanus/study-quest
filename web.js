/* Study Quest: sign-in, approval check and leaderboard connection for the website.
   No libraries: talks to Supabase over plain HTTPS. */
(function () {
  "use strict";
  if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.innerHTML = ""; } return; }

  // folder that holds this script (the site root), so links work from the root and from a guide subfolder
  let ROOT = "./"; try { ROOT = new URL(".", document.currentScript.src).href; } catch (e) {}
  const CFG = window.CS379_CONFIG || {};
  const BASE = String(CFG.supabaseUrl || "").replace(/\/+$/, "");
  const KEY = String(CFG.anonKey || "");
  const SK = "cs379_session";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(BASE) && KEY.length > 20;

  /* ---------- session ---------- */
  let sess = null;
  // read the saved session (shared by every tab of the site); untrusted, so check its shape
  function stored() { try { const raw = localStorage.getItem(SK); if (raw) { const o = JSON.parse(raw); if (o && typeof o.access_token === "string" && typeof o.refresh_token === "string" && o.user && typeof o.user.id === "string") return o; } } catch (e) {} return null; }
  sess = stored();
  // another tab refreshed or signed out: follow it
  try { addEventListener("storage", (e) => { if (e.key === SK) sess = stored(); }); } catch (e) {}
  const keep = (s) => { sess = s; try { s ? localStorage.setItem(SK, JSON.stringify(s)) : localStorage.removeItem(SK); } catch (e) {} };
  const fromAuth = (d) => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600), user: { id: d.user.id, email: String(d.user.email || "").toLowerCase() } });

  async function call(path, opts) {
    opts = opts || {};
    const h = Object.assign({ apikey: KEY, "Content-Type": "application/json" }, opts.headers || {});
    if (opts.auth !== false) { await fresh(); if (sess) h.Authorization = "Bearer " + sess.access_token; }
    const r = await fetch(BASE + path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store", keepalive: !!opts.keepalive });
    let data = null; const txt = await r.text(); try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) { const err = new Error((data && (data.msg || data.message || data.error_description || data.error)) || ("HTTP " + r.status)); err.status = r.status; err.data = data; err.code = data && data.code; throw err; }
    return data;
  }
  let refreshing = null;
  const needsRefresh = (x) => !x || x.expires_at - 60 <= Date.now() / 1000;
  async function fresh() {
    if (!sess) return;
    // another tab may already have refreshed: use its newer session instead of spending ours
    const st = stored(); if (st && st.user.id === sess.user.id && (st.expires_at || 0) > (sess.expires_at || 0)) sess = st;
    if (!needsRefresh(sess)) return;
    if (!refreshing) refreshing = (async () => {
      const run = async () => {
        const again = stored(); if (again && sess && again.user.id === sess.user.id && !needsRefresh(again)) { sess = again; return; }
        const used = sess.refresh_token;
        try { const d = await call("/auth/v1/token?grant_type=refresh_token", { method: "POST", auth: false, body: { refresh_token: used } }); keep(fromAuth(d)); }
        catch (e) {
          if (e.status === 400 || e.status === 401) {
            // refresh tokens can only be used once; if another tab got there first, take its session rather than signing out
            const now = stored();
            if (now && now.refresh_token !== used && sess && now.user.id === sess.user.id) sess = now; else keep(null);
          }
        }
      };
      try { if (navigator.locks && navigator.locks.request) await navigator.locks.request("cs379_session_refresh", run); else await run(); }
      finally { refreshing = null; }
    })();
    return refreshing;
  }
  const sendCode = (email) => call("/auth/v1/otp", { method: "POST", auth: false, body: { email, create_user: true } });
  async function verify(email, code) { const d = await call("/auth/v1/verify", { method: "POST", auth: false, body: { type: "email", email, token: code } }); keep(fromAuth(d)); return sess; }
  async function signOut() { try { await call("/auth/v1/logout", { method: "POST" }); } catch (e) {} keep(null); location.reload(); }
  // The owner is recognised by a salted SHA-256 hash of their email (config ownerSalt + ownerHash), so the address is not in the site code.
  // ownerEmail still works for older configs.
  let ownerFlag = false;
  async function checkOwner() {
    ownerFlag = false;
    if (!sess) return;
    if (CFG.ownerEmail) { ownerFlag = sess.user.email === String(CFG.ownerEmail).toLowerCase(); return; }
    const want = String(CFG.ownerHash || "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(want) || !(window.crypto && crypto.subtle)) return;
    try {
      const salt = /^[0-9a-f]{16,64}$/.test(String(CFG.ownerSalt || "")) ? CFG.ownerSalt + ":" : "";
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + sess.user.email));
      ownerFlag = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("") === want;
    } catch (e) { ownerFlag = false; }
  }
  const isOwner = () => !!(sess && ownerFlag);
  const requestAccess = () => call("/functions/v1/" + (CFG.fnRequest || "dynamic-function"), { method: "POST", body: {} });
  async function myAccess() { const r = await call("/rest/v1/access?select=status,expires_at&user_id=eq." + encodeURIComponent(sess.user.id)); return r && r[0] || null; }

  /* ---------- sign-in card ---------- */
  function card(html) { const a = $("#auth"); a.hidden = false; a.innerHTML = '<div class="authcard" role="dialog" aria-modal="true" aria-labelledby="ah">' + html + "</div>"; }
  const logoSvg = '<svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true"><path d="M32 3L57 12V32C57 47 46 57 32 61C18 57 7 47 7 32V12Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="34" r="9" fill="none" stroke="currentColor" stroke-opacity=".5"/><circle cx="32" cy="34" r="18" fill="none" stroke="currentColor" stroke-opacity=".3"/><g class="sweep"><path d="M32 34L32 12A22 22 0 0 1 51 23Z" fill="currentColor" opacity=".4"/></g></svg>';
  /* guides with a custom look (shared/looks.js, GUIDE.look) get their own logo on the sign-in card */
  const authLogo = () => { const L = window.CSQ_LOOKS, g = window.GUIDE, k = L && g && Object.prototype.hasOwnProperty.call(L, g.look) ? L[g.look] : null; return k ? k.logo("al", 72, false, "") : logoSvg; };
  const top = (title, sub) => '<div class="alogo">' + authLogo() + '</div><h2 id="ah">' + title + '</h2>' + (sub ? '<p class="mut">' + sub + "</p>" : "");

  function askEmail(msg) {
    card(top(String(window.CSQ_TITLE || "Study Quest").replace(/[<>&\"']/g, ""), "Sign in with your email. We email you a one-time code that works for 10 minutes. No password needed.")
      + '<form id="ef" novalidate><label class="lab" for="em">Email</label><input class="ain" id="em" type="email" autocomplete="email" inputmode="email" maxlength="254" required placeholder="you@example.com"><div class="err" role="alert" id="ae">' + (msg ? esc(msg) : "") + '</div><button class="btn" id="eb" type="submit">Send my code</button><p class="mut small consent">By continuing you agree to the <a href="' + esc(ROOT) + 'terms.html">Terms</a> and <a href="' + esc(ROOT) + 'privacy.html">Privacy Policy</a>. We only store your email, callsign and scores.</p></form>');
    const f = $("#ef"), em = $("#em"); setTimeout(() => em.focus(), 50);
    f.onsubmit = async (e) => {
      e.preventDefault(); const v = em.value.trim().toLowerCase();
      if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/.test(v)) { $("#ae").textContent = "Enter a valid email address."; return; }
      $("#eb").disabled = true; $("#ae").textContent = "";
      try { await sendCode(v); askCode(v); }
      catch (err) { $("#eb").disabled = false; $("#ae").textContent = err.status === 429 ? "Too many codes asked for. Wait a minute and try again." : "Could not send the code. Check the address and try again."; }
    };
  }
  function askCode(email) {
    card(top("Check your email", "We sent a code to <b>" + esc(email) + "</b>. It can take a minute; check spam too.")
      + '<form id="cf" novalidate><label class="lab" for="cd">Code</label><input class="ain code" id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required placeholder="123456"><div class="err" role="alert" id="ae"></div><button class="btn" id="cb" type="submit">Sign in</button><button class="lnk" type="button" id="back">Use a different email</button></form>');
    const cd = $("#cd"); setTimeout(() => cd.focus(), 50);
    cd.oninput = () => { cd.value = cd.value.replace(/\D/g, "").slice(0, 10); };
    $("#back").onclick = () => askEmail();
    $("#cf").onsubmit = async (e) => {
      e.preventDefault(); if (cd.value.length < 6) { $("#ae").textContent = "Enter the code from the email."; return; }
      $("#cb").disabled = true;
      try { await verify(email, cd.value); start(); }
      catch (err) { $("#cb").disabled = false; $("#ae").textContent = "That code did not work or has expired. Try again or ask for a new one."; }
    };
  }
  let poll = 0;
  function waiting(status) {
    const denied = status === "denied";
    card(top(denied ? "Request declined" : "Waiting for approval",
      denied ? "Logan declined this request. You can ask again tomorrow." : "Your request was sent to Logan. This page opens by itself as soon as he allows you in. You can close it and come back later.")
      + (denied ? "" : '<div class="spin" aria-hidden="true"></div>')
      + '<p class="mut small">Signed in as ' + esc(sess.user.email) + '</p><button class="lnk" id="so" type="button">Sign out</button>');
    $("#so").onclick = signOut;
    clearInterval(poll);
    if (!denied) poll = setInterval(async () => {
      if (document.hidden) return;
      try { const a = await myAccess(); if (a && a.status === "approved" && Date.parse(a.expires_at) > Date.now()) { clearInterval(poll); start(); } else if (a && a.status === "denied") { clearInterval(poll); waiting("denied"); } }
      catch (e) { if (e.status === 401) { clearInterval(poll); keep(null); askEmail(); } }
    }, 10000);
  }
  function problem(msg) { card(top("Something went wrong", esc(msg)) + '<button class="btn" id="rt" type="button">Try again</button> <button class="lnk" id="so" type="button">Sign out</button>'); $("#rt").onclick = start; $("#so").onclick = signOut; }

  /* ---------- the flow ---------- */
  let onReady = null;
  async function start() {
    if (!configured) { card(top("Almost set up", "Open <b>config.js</b> and paste in your Supabase URL and anon key (setup guide, step 4).")); return; }
    await fresh();
    if (!sess) return askEmail();
    card(top("Checking access…", "") + '<div class="spin" aria-hidden="true"></div>');
    let st;
    await checkOwner();
    if (isOwner()) st = { status: "approved", owner: true }; // the owner never waits on the server function
    else {
      try { st = await requestAccess(); }
      catch (e) {
        if (e.status === 401) { keep(null); return askEmail("Your sign-in expired. Please sign in again."); }
        const why = !e.status ? "The request-access function blocked or did not answer (no response). Usually the SITE_URL secret does not match this site's address, or the function is not deployed."
          : e.status === 404 ? "The request-access function was not found (404). Check it is deployed with exactly that name."
          : e.status === 500 ? "The request-access function crashed (500): " + e.message + ". Check that schema.sql ran in the SQL Editor."
          : "Server answered " + e.status + ": " + e.message;
        return problem("Could not check your access. " + why);
      }
    }
    if (!st || st.status !== "approved") return waiting(st && st.status);
    $("#auth").hidden = true; $("#auth").innerHTML = "";
    if (onReady) onReady(st);
  }

  /* ---------- leaderboard in the same shape the study app already uses ---------- */
  function boardAdapter(guide) {
    if (!/^[a-z0-9-]{2,32}$/.test(String(guide))) throw new Error("Invalid guide id");
    const listeners = new Set(); let timer = 0;
    async function pull() {
      try {
        const rows = await call("/rest/v1/scores?select=user_id,n,xp,lv,best,bq&guide=eq." + guide + "&order=best.desc,xp.desc&limit=200");
        const snap = { docs: (rows || []).map((r) => ({ id: r.user_id, data: () => ({ n: r.n, xp: r.xp, lv: r.lv, best: r.best, bq: r.bq }) })) };
        listeners.forEach((l) => l[0](snap));
      } catch (e) {
        if (e.status === 401 || e.status === 403) { keep(null); location.reload(); return; }
        listeners.forEach((l) => l[1] && l[1](new Error("The leaderboard is not answering right now.")));
      }
    }
    function arm() { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) pull(); }, 20000); }
    document.addEventListener("visibilitychange", () => { if (!document.hidden && listeners.size) pull(); });
    return {
      collection: () => ({
        limit: () => ({ onSnapshot(ok, bad) { const l = [ok, bad]; listeners.add(l); pull(); arm(); return () => listeners.delete(l); } }),
        doc: (id) => ({
          async set(p) {
            try {
              await call("/rest/v1/scores?on_conflict=user_id,guide", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
                body: { user_id: id, guide, n: p.n, xp: p.xp | 0, lv: p.lv | 0, best: p.best | 0, bq: p.bq | 0, t: Math.floor(+p.t) || null } });
              pull();
            } catch (e) { const err = new Error(e.code === "23505" ? "That callsign is already taken." : "Could not save the score."); err.code = e.code === "23505" ? "taken" : (e.status === 403 ? "not_granted" : "failed"); throw err; }
          }
        })
      })
    };
  }

  /* ---------- suggestion box (supabase: public.suggestions) ---------- */
  const GUIDE_ID = /^[a-z0-9-]{2,32}$/, QID = /^(s|ga|gd)\d{1,5}$/;
  // CSQ.suggest({kind: "idea"|"problem", body, guide: guide id or "hub", qid?, qtext?, page?}) -> Promise; rejects with a readable Error.message
  async function suggest(o) {
    o = o && typeof o === "object" ? o : {};
    const kind = o.kind === "problem" ? "problem" : o.kind === "idea" ? "idea" : "";
    const body = typeof o.body === "string" ? o.body.trim() : "";
    const guide = typeof o.guide === "string" && (o.guide === "hub" || GUIDE_ID.test(o.guide)) ? o.guide : "";
    if (!kind) throw new Error("Pick a type: suggestion or problem.");
    if (!body) throw new Error("Write a few words first.");
    if (body.length > 1000) throw new Error("That is too long. Keep it under 1000 characters.");
    if (!guide) throw new Error("Could not tell which page this is from.");
    const qid = typeof o.qid === "string" && QID.test(o.qid) ? o.qid : null;
    const qtext = typeof o.qtext === "string" && o.qtext.trim() ? o.qtext.trim().slice(0, 500) : null;
    const page = typeof o.page === "string" && o.page.trim() ? o.page.trim().slice(0, 40) : null;
    if (!sess) throw new Error("Sign in first, then try again.");
    try { await call("/rest/v1/suggestions", { method: "POST", headers: { Prefer: "return=minimal" }, body: { guide, kind, body, qid, qtext, page } }); }
    catch (e) {
      if (e.code === "P0001" && e.message) throw new Error(e.message); // the server's own rate-limit wording
      if (e.status === 401 || e.status === 403) throw new Error("Only signed-in, approved people can send suggestions. Please sign in again.");
      if (!e.status) throw new Error("Could not reach the server. Check your connection and try again.");
      if (e.status === 400 || e.status === 422) throw new Error("That could not be sent. Check the text and try again.");
      throw new Error("Could not send that right now. Please try again later.");
    }
  }

  /* ---------- answer statistics (supabase: public.record_answers) ---------- */
  // CSQ.recordAnswers(guideId, [{k: "s12", ok: true}, ...]): fire-and-forget; sends in chunks of 100 (at most 400 answers); never throws
  async function recordAnswers(guideId, rows) {
    try {
      if (!sess || typeof guideId !== "string" || !GUIDE_ID.test(guideId) || !Array.isArray(rows)) return;
      const list = [];
      for (const r of rows) {
        if (r && typeof r === "object" && typeof r.k === "string" && QID.test(r.k) && typeof r.ok === "boolean") list.push({ k: r.k, ok: r.ok });
        if (list.length >= 400) break;
      }
      for (let i = 0; i < list.length; i += 100) {
        try { await call("/rest/v1/rpc/record_answers", { method: "POST", body: { p_guide: guideId, p_rows: list.slice(i, i + 100) } }); }
        catch (e) { if (e && (e.status === 401 || e.status === 403 || e.code === "P0001")) return; } // not allowed or rate-limited: stop quietly
      }
    } catch (e) { /* statistics must never get in the way of studying */ }
  }

  /* ---------- study progress sync (supabase: public.progress, one row per person per guide) ---------- */
  // CSQ.progress.get(guide) -> {data, updated_at} (data is null when no row exists yet) or null on any error
  // CSQ.progress.put(guide, data, {keepalive}) -> true, false, "later" (rate limited) or "bad" (rejected);  CSQ.progress.list() -> [{guide, data: {ks, xp}, updated_at}] or null
  // Nothing here throws; everything that comes back is untrusted and must be validated by the caller.
  const progress = {
    async get(guide) {
      try {
        if (!sess || !GUIDE_ID.test(String(guide))) return null;
        const r = await call("/rest/v1/progress?select=guide,data,updated_at&guide=eq." + guide + "&limit=1");
        if (!Array.isArray(r)) return null;
        const row = r[0];
        return row && typeof row === "object" ? { data: row.data, updated_at: typeof row.updated_at === "string" ? row.updated_at : null } : { data: null, updated_at: null };
      } catch (e) { return null; }
    },
    async put(guide, data, o) {
      try {
        if (!sess || !GUIDE_ID.test(String(guide)) || !data || typeof data !== "object" || Array.isArray(data)) return false;
        await call("/rest/v1/progress?on_conflict=user_id,guide", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: { guide, data }, keepalive: !!(o && o.keepalive) });
        return true;
      } catch (e) { return e && e.code === "P0001" ? "later" : e && e.code === "23514" ? "bad" : false; } // "later": saved too quickly (retry in a moment); "bad": rejected for size or shape (do not retry)
    },
    async list() {
      try {
        if (!sess) return null;
        const r = await call("/rest/v1/progress?select=guide,updated_at,ks:data->ks,xp:data->xp&limit=100");
        if (!Array.isArray(r)) return null;
        return r.filter((x) => x && typeof x === "object" && GUIDE_ID.test(String(x.guide))).map((x) => ({ guide: String(x.guide), data: { ks: x.ks, xp: x.xp }, updated_at: typeof x.updated_at === "string" ? x.updated_at : null }));
      } catch (e) { return null; }
    }
  };

  window.CSQ = { root: ROOT, cfg: CFG, start, signOut, isOwner, call, get session() { return sess; }, set onReady(f) { onReady = f; }, boardAdapter, esc, suggest, recordAnswers, progress };
})();
