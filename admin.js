/* Owner page: approve, deny or revoke people, and remove leaderboard rows. */
(function () {
  "use strict";
  const CSQ = window.CSQ; if (!CSQ) return;
  const $ = (s) => document.querySelector(s), esc = CSQ.esc;
  const qs = new URLSearchParams(location.search);
  const focusId = /^[0-9a-f-]{36}$/i.test(qs.get("id") || "") ? qs.get("id") : "";
  const focusTok = /^[0-9a-f]{48}$/.test(qs.get("t") || "") ? qs.get("t") : "";
  // drop the token from the address bar once read
  try { if (location.search) history.replaceState(null, "", location.pathname + (focusId ? "#" + focusId : "")); } catch (e) {}
  const main = $("#admin");
  const when = (s) => s ? new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
  const daysLeft = (s) => Math.max(0, Math.ceil((Date.parse(s) - Date.now()) / 864e5));

  function label(r) {
    if (r.status === "approved" && r.expires_at && Date.parse(r.expires_at) > Date.now()) return '<span class="tag ok">Allowed · ' + daysLeft(r.expires_at) + " days left</span>";
    if (r.status === "approved") return '<span class="tag">Expired</span>';
    if (r.status === "pending") return '<span class="tag warn">Waiting for you</span>';
    return '<span class="tag bad">Denied</span>';
  }

  let last = ""; // signature of the data last rendered; an unchanged refresh leaves the DOM alone
  async function decide(id, action, t) {
    try { await CSQ.call("/functions/v1/" + (CSQ.cfg.fnDecide || "rapid-processor"), { method: "POST", body: { id, action, t: t || undefined } }); toast(action === "allow" ? "Allowed for 30 days" : action === "deny" ? "Denied" : "Access removed"); }
    catch (e) { toast(e.message || "That did not work"); }
    last = ""; load();
  }
  const GID = /^[a-z0-9-]{2,32}$/;
  let guideNames = {};
  let guidesP = null;
  const loadGuides = () => guidesP || (guidesP = (async () => {
    try {
      const r = await fetch(CSQ.root + "guides.json", { cache: "no-store" });
      const list = r.ok ? await r.json() : [];
      if (Array.isArray(list)) list.forEach((g) => { if (g && typeof g.id === "string" && typeof g.name === "string") guideNames[g.id] = g.name; });
    } catch (e) {}
    if (!Object.keys(guideNames).length) guidesP = null; // nothing loaded: try again next time
  })());
  async function removeScore(id, guide, n) {
    try { await CSQ.call("/rest/v1/scores?user_id=eq." + encodeURIComponent(id) + "&guide=eq." + encodeURIComponent(guide), { method: "DELETE" }); toast(n + " removed from the leaderboard"); }
    catch (e) { toast("Could not remove that row"); }
    last = ""; load();
  }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }

  function boardHtml(sc) {
    const groups = {}, order = [];
    sc.forEach((s) => { const g = GID.test(String(s.guide)) ? String(s.guide) : "unknown"; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(s); });
    order.sort();
    return order.map((g) => '<h3 class="gh">' + esc(guideNames[g] || g) + ' <span class="mut small">(' + groups[g].length + ")</span></h3>"
      + groups[g].map((s) => '<div class="req"><div class="who"><b class="cs">' + esc(s.n) + "</b> <span class=\"mut small\">" + (s.best | 0) + "% best · " + (s.xp | 0) + ' XP</span></div><div class="acts"><button class="btn s g" data-del="' + esc(s.user_id) + '" data-guide="' + esc(g) + '" data-n="' + esc(s.n) + '">Remove</button></div></div>').join("")).join("");
  }

  async function load() {
    let acc = [], sc = [];
    try {
      if (!Object.keys(guideNames).length) await loadGuides();
      [acc, sc] = await Promise.all([
        CSQ.call("/rest/v1/access?select=user_id,email,status,requested_at,decided_at,expires_at&order=requested_at.desc"),
        CSQ.call("/rest/v1/scores?select=user_id,n,xp,best,guide&order=guide.asc,best.desc,xp.desc")
      ]);
    } catch (e) { last = ""; main.innerHTML = '<div class="card"><p class="err">Could not load: ' + esc(e.message) + "</p></div>"; return; }
    const sig = JSON.stringify([acc, sc, acc.map(label)]); // labels carry the time-based parts ("days left", expired)
    if (sig === last) return;
    last = sig;
    const pend = acc.filter((r) => r.status === "pending");
    const rest = acc.filter((r) => r.status !== "pending");
    const row = (r) => '<div class="req' + (r.user_id === focusId ? " focus" : "") + '" id="r-' + esc(r.user_id) + '"><div class="who"><b>' + esc(r.email) + "</b> " + label(r)
      + '<div class="mut small">Asked ' + esc(when(r.requested_at)) + (r.expires_at && r.status === "approved" ? " · ends " + esc(when(r.expires_at)) : "") + "</div></div><div class=\"acts\">"
      + (r.status !== "approved" || Date.parse(r.expires_at) <= Date.now() ? '<button class="btn s" data-a="allow" data-id="' + esc(r.user_id) + '">Allow 30 days</button>' : "")
      + (r.status === "pending" ? '<button class="btn s g" data-a="deny" data-id="' + esc(r.user_id) + '">Deny</button>' : "")
      + (r.status === "approved" && Date.parse(r.expires_at) > Date.now() ? '<button class="btn s g" data-a="revoke" data-id="' + esc(r.user_id) + '">Remove access</button>' : "")
      + "</div></div>";
    const live = (r) => r.status === "approved" && r.expires_at && Date.parse(r.expires_at) > Date.now();
    const stats = $("#stats");
    stats.innerHTML = [["PENDING", pend.length, pend.length ? "hot" : ""], ["ACTIVE", acc.filter(live).length, "act"], ["DENIED", acc.filter((r) => r.status === "denied").length, "den"], ["SCORE ROWS", sc.length, ""]]
      .map((x) => '<div class="st ' + x[2] + '"><span>' + x[0] + "</span><b>" + (x[1] | 0) + "</b></div>").join("");
    stats.hidden = false;
    main.innerHTML = '<div class="card"><span class="kick">Queue</span><h2>Waiting for you (' + pend.length + ")</h2>" + (pend.length ? pend.map(row).join("") : '<p class="mut">No one is waiting.</p>') + "</div>"
      + '<div class="card"><span class="kick">Roster</span><h2>Everyone else</h2>' + (rest.length ? rest.map(row).join("") : '<p class="mut">No one yet.</p>') + "</div>"
      + '<div class="card"><span class="kick">Scoreboard</span><h2>Leaderboard rows</h2><p class="mut small">Remove a row if a callsign is rude or fake. The person can pick a new one.</p>'
      + (sc.length ? boardHtml(sc) : '<p class="mut">No scores yet.</p>') + "</div>";
    main.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => { b.disabled = true; decide(b.dataset.id, b.dataset.a, b.dataset.id === focusId ? focusTok : ""); });
    main.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => {
      if (b.dataset.sure) { b.disabled = true; removeScore(b.dataset.del, b.dataset.guide, b.dataset.n); }
      else { b.dataset.sure = "1"; b.textContent = "Tap again to remove"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "Remove"; } }, 4000); }
    });
    const f = focusId && document.getElementById("r-" + focusId); if (f) f.scrollIntoView({ block: "center" });
  }

  /* ---------- suggestions inbox (public.suggestions via the owner-only suggestions_inbox() RPC) ---------- */
  const QID = /^(s|ga|gd)\d{1,5}$/;
  const sgBox = $("#sugg");
  let sg = [], sgFilter = "all", sgSel = new Set(), sgAsk = "", sgSig = "", sgErr = "", sgBusy = false;
  const longWhen = (s) => { const d = new Date(s); return isNaN(d) ? "—" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); };
  const whereLabel = (g) => g === "hub" ? "Hub" : (guideNames[g] || (GID.test(g) ? g : "unknown"));
  const sgClean = (r) => r && typeof r === "object" && Number.isSafeInteger(r.id) ? {
    id: r.id, at: String(r.created_at || ""), email: String(r.email || ""), guide: String(r.guide || ""), kind: r.kind === "problem" ? "problem" : "idea",
    body: String(r.body || "").slice(0, 1000), qid: QID.test(String(r.qid)) ? String(r.qid) : "", qtext: String(r.qtext || "").slice(0, 500), page: String(r.page || "").slice(0, 40), read: r.read === true } : null;
  const sgIds = (ids) => ids.filter((n) => Number.isSafeInteger(n));
  const sgVisible = () => sg.filter((x) => sgFilter === "all" || (sgFilter === "unread") === !x.read);
  const missingHint = (e, what) => e && (e.status === 404 || e.code === "PGRST202" || e.code === "PGRST205" || e.code === "42P01")
    ? what + " is not set up in the database yet. Run supabase/migrations/2026-11-18-features.sql in the Supabase SQL Editor, then reload." : "Could not load " + what + ": " + (e && e.message || "error");

  function sgItem(x) {
    const asking = sgAsk === "one:" + x.id;
    return '<article class="sg' + (x.read ? "" : " unread") + '"><label class="chk"><input type="checkbox" data-sel="' + x.id + '"' + (sgSel.has(x.id) ? " checked" : "") + ' aria-label="Select suggestion from ' + esc(x.email || "unknown sender") + '"></label><div class="main">'
      + '<div class="meta"><time datetime="' + esc(x.at) + '">' + esc(longWhen(x.at)) + "</time> · <b>" + esc(x.email || "unknown sender") + "</b> · " + esc(whereLabel(x.guide)) + (x.page ? " · " + esc(x.page) : "") + "</div>"
      + '<div style="margin-top:6px">' + (x.kind === "problem" ? '<span class="tag bad">Problem</span>' : '<span class="tag">Suggestion</span>') + (x.read ? '<span class="tag ok">Read</span>' : '<span class="tag warn">New</span>') + "</div>"
      + '<p class="txt">' + esc(x.body) + "</p>"
      + (x.qid || x.qtext ? '<blockquote><span class="kick">About question' + (x.qid ? " " + esc(x.qid) : "") + "</span>" + esc(x.qtext) + "</blockquote>" : "")
      + '<div class="sgacts"><button type="button" class="btn s g" data-read="' + x.id + '" data-to="' + (x.read ? 0 : 1) + '">Mark ' + (x.read ? "unread" : "read") + "</button>"
      + (asking ? '<span class="ask" role="alert">Delete this suggestion?</span><button type="button" class="btn s" data-yes="one">Yes, delete</button><button type="button" class="btn s g" data-no="1">Cancel</button>'
                : '<button type="button" class="btn s g" data-del1="' + x.id + '">Delete</button>')
      + "</div></div></article>";
  }

  function sgRender(focus) {
    const unread = sg.filter((x) => !x.read).length, vis = sgVisible();
    sgSel = new Set([...sgSel].filter((id) => vis.some((x) => x.id === id)));
    const n = sgSel.size, asking = sgAsk === "bulk" && n > 0;
    if (sgAsk === "bulk" && !n) sgAsk = "";
    if (sgAsk.startsWith("one:") && !vis.some((x) => "one:" + x.id === sgAsk)) sgAsk = "";
    const fb = (k, label, c) => '<button type="button" class="btn s g" data-f="' + k + '" aria-pressed="' + (sgFilter === k) + '">' + label + " (" + c + ")</button>";
    sgBox.hidden = false;
    sgBox.innerHTML = '<div class="card"><span class="kick">Inbox</span><h2 id="sg-h" tabindex="-1">Suggestions<span class="cnt" id="sg-badge"' + (unread ? "" : " hidden") + ">" + unread + " new</span></h2>"
      + '<p class="mut small">Ideas and problem reports sent from the hub and the guides.</p>'
      + (sgErr ? '<p class="err" role="alert">' + esc(sgErr) + '</p><button type="button" class="btn s g" data-retry="1">Try again</button>'
        : '<div class="filters" role="group" aria-label="Show">' + fb("all", "All", sg.length) + fb("unread", "Unread", unread) + fb("read", "Read", sg.length - unread) + "</div>"
          + (vis.length ? '<div class="bulk"><label class="chk"><input type="checkbox" id="sg-all"' + (n && n === vis.length ? " checked" : "") + "> <span>Select all visible</span></label>"
            + '<div class="acts"><button type="button" class="btn s g" data-bulk="read"' + (n ? "" : " disabled") + ">Mark read" + (n ? " (" + n + ")" : "") + '</button><button type="button" class="btn s g" data-bulk="unread"' + (n ? "" : " disabled") + ">Mark unread" + (n ? " (" + n + ")" : "") + "</button>"
            + (asking ? '<span class="ask" role="alert">Delete ' + n + (n === 1 ? " suggestion?" : " suggestions?") + '</span><button type="button" class="btn s" data-yes="bulk">Yes, delete ' + n + '</button><button type="button" class="btn s g" data-no="1">Cancel</button>'
                      : '<button type="button" class="btn s g" id="sg-bdel"' + (n ? "" : " disabled") + ">Delete selected" + (n ? " (" + n + ")" : "") + "</button>") + "</div></div>"
            + vis.map(sgItem).join("")
            : '<p class="mut">' + (sg.length ? "Nothing in this view." : "No suggestions yet.") + "</p>")) + "</div>";
    const all = sgBox.querySelector("#sg-all"); if (all) all.indeterminate = n > 0 && n < vis.length;
    const badge = $("#navcnt"); badge.textContent = unread; badge.hidden = !unread;
    if (focus !== undefined) { const el = (focus && sgBox.querySelector(focus)) || sgBox.querySelector("#sg-h"); if (el) el.focus(); }
  }

  async function sgLoad() {
    let rows;
    await loadGuides();
    try { rows = await CSQ.call("/rest/v1/rpc/suggestions_inbox", { method: "POST", body: { p_limit: 500 } }); }
    catch (e) { sgErr = missingHint(e, "the suggestion box"); sgSig = ""; sgRender(); return; }
    sgErr = "";
    const list = (Array.isArray(rows) ? rows : []).map(sgClean).filter(Boolean);
    const sig = JSON.stringify(list);
    if (sig === sgSig && !sgBox.hidden) return;
    sgSig = sig; sg = list; sgRender();
  }

  // PATCH/DELETE by id list (validated integers only); answers with the ids that really changed (RLS can hide rows without an error)
  async function sgChange(ids, method, body) {
    ids = sgIds(ids); let done = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const part = ids.slice(i, i + 100);
      const r = await CSQ.call("/rest/v1/suggestions?id=in.(" + part.join(",") + ")&select=id", { method, headers: { Prefer: "return=representation" }, body });
      done += Array.isArray(r) ? r.length : 0;
    }
    return done;
  }
  async function sgAct(kind, ids, focus) {
    if (sgBusy || !ids.length) return; sgBusy = true;
    try {
      const done = kind === "delete" ? await sgChange(ids, "DELETE") : await sgChange(ids, "PATCH", { read: kind === "read" });
      if (done !== ids.length) toast(done ? "Only " + done + " of " + ids.length + " changed" : "Nothing changed. Are you signed in as the owner?");
      else toast(kind === "delete" ? (done === 1 ? "Suggestion deleted" : done + " suggestions deleted") : (done === 1 ? "Marked " + kind : done + " marked " + kind));
    } catch (e) { toast("That did not work: " + (e.message || "error")); }
    sgBusy = false; sgAsk = ""; sgSel = new Set(); sgSig = "";
    await sgLoad(); sgRender(focus);
  }

  sgBox.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "sg-all") { sgSel = t.checked ? new Set(sgVisible().map((x) => x.id)) : new Set(); sgAsk = ""; sgRender("#sg-all"); }
    else if (t.dataset && t.dataset.sel) { const id = +t.dataset.sel; t.checked ? sgSel.add(id) : sgSel.delete(id); if (sgAsk === "bulk") sgAsk = ""; sgRender('[data-sel="' + id + '"]'); }
  });
  sgBox.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button"); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.f) { sgFilter = d.f; sgSel = new Set(); sgAsk = ""; sgRender('[data-f="' + d.f + '"]'); }
    else if (d.retry) { sgLoad(); }
    else if (d.read) sgAct(d.to === "1" ? "read" : "unread", [+d.read], '[data-read="' + (+d.read) + '"]');
    else if (d.bulk) sgAct(d.bulk, [...sgSel], '[data-bulk="' + d.bulk + '"]');
    else if (d.del1) { sgAsk = "one:" + (+d.del1); sgRender("[data-no]"); }
    else if (b.id === "sg-bdel") { sgAsk = "bulk"; sgRender("[data-no]"); }
    else if (d.no) { const was = sgAsk; sgAsk = ""; sgRender(was === "bulk" ? "#sg-bdel" : '[data-del1="' + was.slice(4) + '"]'); }
    else if (d.yes === "one") sgAct("delete", [+sgAsk.slice(4)], "");
    else if (d.yes === "bulk") sgAct("delete", [...sgSel], "");
  });

  /* ---------- quiz stats (public.qstats, owner-only; question text rebuilt from the guide's content file) ---------- */
  const qsBox = $("#qst");
  const contentCache = {};
  let qsToken = 0, qsShowAll = false, qsRows = [], qsMeta = null, qsNote = "";
  const CONTENT_BASE = "/storage/v1/object/authenticated/content/";
  async function guideContent(id) {
    if (contentCache[id]) return contentCache[id];
    let d;
    try { d = await CSQ.call(CONTENT_BASE + id + ".json"); }
    catch (e) { if (id === "cs379") d = await CSQ.call(CONTENT_BASE + "content.json"); else throw e; } // the live CS 379 site once stored content.json
    if (!d || typeof d !== "object" || !Array.isArray(d.STATIC) || !Array.isArray(d.G)) throw new Error("content file has an unexpected shape");
    return (contentCache[id] = d);
  }
  // keys follow shared/app.js: s<i> = STATIC[i] (chapter "12" rows are skipped there), ga<i>/gd<i> = glossary row i
  function describeQ(qid, data) {
    if (!data) return { text: "", sub: "" };
    const m = /^(s|ga|gd)(\d+)$/.exec(qid); if (!m) return { text: "", sub: "" };
    const i = +m[2];
    if (m[1] === "s") {
      const r = data.STATIC[i];
      if (!Array.isArray(r) || String(r[0]) === "12") return { text: "", sub: "" };
      const opts = Array.isArray(r[3]) ? r[3] : [];
      return { text: String(r[2] == null ? "" : r[2]), sub: opts[r[4]] != null ? "Answer: " + String(opts[r[4]]) : "" };
    }
    const g = data.G[i];
    return Array.isArray(g) ? { text: "Glossary: " + String(g[1] == null ? "" : g[1]), sub: "" } : { text: "", sub: "" };
  }
  const num = (v) => { v = Math.floor(+v); return Number.isFinite(v) && v >= 0 ? Math.min(v, 1e9) : 0; };

  function qsOptions() {
    const ids = Object.keys(guideNames); if (!ids.length) ids.push("cs379");
    return '<option value="">Choose a guide…</option>' + ids.map((g) => '<option value="' + esc(g) + '">' + esc(guideNames[g] || g) + "</option>").join("");
  }
  function qsShell() {
    qsBox.hidden = false;
    qsBox.innerHTML = '<div class="card"><span class="kick">Statistics</span><h2 id="qs-h">Quiz stats</h2><p class="mut small">Anonymous right and wrong counts from finished quizzes and tests. Shows questions answered at least 3 times, most missed first.</p>'
      + '<label class="lab" for="qs-guide">Guide</label><select class="ain" id="qs-guide">' + qsOptions() + '</select><div id="qs-out" aria-live="polite"></div></div>';
    $("#qs-guide").onchange = (e) => { qsShowAll = false; qsLoad(e.target.value); };
  }
  function qsPaint(data) {
    const out = $("#qs-out"); if (!out) return;
    const shown = qsShowAll ? qsRows : qsRows.slice(0, 50);
    out.innerHTML = '<p class="small mut" style="margin-top:12px">' + qsMeta.total + " answers recorded over " + qsMeta.questions + " questions · " + qsRows.length + " answered at least 3 times." + (qsNote ? " " + esc(qsNote) : "") + ' <button type="button" class="lnk" id="qs-refresh" style="margin:0 0 0 6px;min-height:40px">Refresh</button></p>'
      + (qsRows.length ? '<ol class="qlist">' + shown.map((r) => {
        const q = describeQ(r.qid, data), pct = Math.round(100 * r.wrong / (r.right + r.wrong));
        return '<li class="qrow"><div class="qtop"><b class="pct">' + pct + '%</b><span class="mut small">missed · ' + r.wrong + " wrong of " + (r.right + r.wrong) + ' answers</span></div><div class="mbar" role="img" aria-label="' + pct + '% missed"><i style="width:' + pct + '%"></i></div>'
          + "<p>" + (q.text ? esc(q.text) : '<span class="mut">(question no longer in this guide)</span>') + '</p><p class="mut small">' + (q.sub ? esc(q.sub) + " · " : "") + '<span class="mono">' + esc(r.qid) + "</span></p></li>";
      }).join("") + "</ol>" + (qsRows.length > 50 && !qsShowAll ? '<button type="button" class="btn s g" id="qs-more" style="margin-top:10px">Show all ' + qsRows.length + "</button>" : "")
        : '<p class="mut">No question has been answered 3 times yet.</p>');
    $("#qs-refresh").onclick = () => { delete contentCache[$("#qs-guide").value]; qsLoad($("#qs-guide").value); };
    const more = $("#qs-more"); if (more) more.onclick = () => { qsShowAll = true; qsPaint(data); };
  }
  async function qsLoad(g) {
    const out = $("#qs-out"); if (!out) return;
    if (!GID.test(g)) { out.innerHTML = ""; return; }
    const mine = ++qsToken; out.innerHTML = '<p class="mut small" style="margin-top:12px">Loading…</p>';
    const [st, ct] = await Promise.allSettled([
      CSQ.call("/rest/v1/qstats?select=qid,right,wrong&guide=eq." + encodeURIComponent(g) + "&order=wrong.desc&limit=1000"), guideContent(g)]);
    if (mine !== qsToken) return;
    if (st.status === "rejected") { out.innerHTML = '<p class="err" role="alert" style="margin-top:12px">' + esc(missingHint(st.reason, "the quiz statistics")) + "</p>"; return; }
    const list = (Array.isArray(st.value) ? st.value : []).filter((r) => r && QID.test(String(r.qid))).map((r) => ({ qid: String(r.qid), right: num(r.right), wrong: num(r.wrong) }));
    qsMeta = { questions: list.length, total: list.reduce((a, r) => a + r.right + r.wrong, 0) };
    qsRows = list.filter((r) => r.right + r.wrong >= 3).sort((a, b) => b.wrong / (b.right + b.wrong) - a.wrong / (a.right + a.wrong) || (b.right + b.wrong) - (a.right + a.wrong) || (a.qid < b.qid ? -1 : 1));
    qsNote = ct.status === "rejected" ? "Could not load this guide's content, so only question IDs are shown." : "";
    qsPaint(ct.status === "fulfilled" ? ct.value : null);
  }

  CSQ.onReady = function () {
    $("#bar").hidden = false;
    $("#signout").onclick = CSQ.signOut;
    $("#gosugg").hidden = !CSQ.isOwner();
    if (!CSQ.isOwner()) { main.innerHTML = '<div class="card"><h2>Owner only</h2><p class="mut">This page is only for Logan. <a href="./">Go to Study Quest</a>.</p></div>'; return; }
    load().then(() => { qsShell(); }); sgLoad();
    setInterval(() => { if (!document.hidden) { load(); sgLoad(); } }, 30000);
  };
  CSQ.start();
})();
