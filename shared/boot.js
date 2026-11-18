/* Loads the private study content for window.GUIDE once access is confirmed, then starts the study app. */
(function () {
  "use strict";
  const CSQ = window.CSQ, GUIDE = window.GUIDE; if (!CSQ || !GUIDE || !/^[a-z0-9-]{2,32}$/.test(String(GUIDE.id))) return;
  const valid = (d) => d && typeof d === "object" && d.CH && d.N && d.IMG && Array.isArray(d.G) && Array.isArray(d.STATIC);
  const base = "/storage/v1/object/authenticated/content/";
  const esc = CSQ.esc;

  CSQ.onReady = async function () {
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
    // the study app looks for its leaderboard/user provider in window.CSQ_DB; give it ours
    const uid = CSQ.session.user.id, board = CSQ.boardAdapter(GUIDE.id);
    window.CSQ_DB = Object.freeze({ use: async (n) => n === "db" ? board : n === "user" ? { id: async () => uid } : null });

    // optional Proofs feature: only guides whose content has an "X" object load proofs.js (before app.js)
    const hasX = data.X && typeof data.X === "object" && !Array.isArray(data.X);
    if (hasX) window.X = data.X;
    const s = document.createElement("script"); s.src = "../shared/app.js?v=13"; s.defer = true;
    s.onload = () => {
      const bar = document.getElementById("acct");
      bar.hidden = false;
      bar.innerHTML = '<a href="../">All guides</a> · ' + (CSQ.isOwner() ? '<a href="../admin.html">Admin</a> · ' : "") + '<a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a> · <button type="button" id="signout">Sign out</button>';
      document.getElementById("signout").onclick = CSQ.signOut;
    };
    if (hasX) {
      const p = document.createElement("script"); p.src = "../shared/proofs.js?v=1"; p.defer = true;
      p.onload = () => document.body.appendChild(s);
      p.onerror = () => { delete window.X; document.body.appendChild(s); };
      document.body.appendChild(p);
    } else document.body.appendChild(s);
  };
  CSQ.start();
})();
