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
  async function loadGuides() {
    try {
      const r = await fetch(CSQ.root + "guides.json", { cache: "no-store" });
      const list = r.ok ? await r.json() : [];
      if (Array.isArray(list)) list.forEach((g) => { if (g && typeof g.id === "string" && typeof g.name === "string") guideNames[g.id] = g.name; });
    } catch (e) {}
  }
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

  CSQ.onReady = function () {
    $("#bar").hidden = false;
    $("#signout").onclick = CSQ.signOut;
    if (!CSQ.isOwner()) { main.innerHTML = '<div class="card"><h2>Owner only</h2><p class="mut">This page is only for Logan. <a href="./">Go to Study Quest</a>.</p></div>'; return; }
    load(); setInterval(() => { if (!document.hidden) load(); }, 30000);
  };
  CSQ.start();
})();
