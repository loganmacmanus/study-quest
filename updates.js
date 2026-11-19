/* Study Quest updates page: reads updates.json, shows every entry newest first with its exact date and time in the
   viewer's own time zone (with the zone name), and marks everything as seen (clears the bell dot on the hub). */
(function () {
  "use strict";
  const SEEN = "sq_upd_seen";
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
  const TYPES = { guide: "New guide", feature: "New feature", fix: "Fix" };
  const box = document.getElementById("list"), tzNote = document.getElementById("tz");
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const goodTime = (t) => typeof t === "string" && ISO.test(t) && Number.isFinite(Date.parse(t));

  /* untrusted file: keep only well-formed items, cap lengths and counts */
  function clean(j) {
    if (!j || typeof j !== "object" || !Array.isArray(j.items)) return null;
    const out = [];
    for (const it of j.items.slice(0, 200)) {
      if (!it || typeof it !== "object" || !goodTime(it.t)) continue; // e.g. the RELEASE_TIME placeholder is skipped
      if (typeof it.title !== "string" || !it.title.trim() || it.title.length > 100) continue;
      out.push({
        t: it.t, ms: Date.parse(it.t), type: TYPES[it.type] ? it.type : "feature", title: it.title.trim(),
        body: typeof it.body === "string" ? it.body.slice(0, 800) : "",
        guides: Array.isArray(it.guides) ? it.guides.filter((g) => typeof g === "string" && /^[a-z0-9-]{2,32}$/.test(g)).slice(0, 8) : []
      });
    }
    return out.sort((a, b) => b.ms - a.ms);
  }

  function when(ms) {
    try { return new Date(ms).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }); }
    catch (e) { return new Date(ms).toString(); }
  }
  function zone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } }

  function render(items, names, prevSeen) {
    box.textContent = "";
    if (!items.length) { box.appendChild(el("p", "mut", "No updates yet.")); return; }
    const ol = el("ol", "upd");
    for (const it of items) {
      const li = el("li"), head = el("div", "uh");
      if (it.ms > prevSeen) head.appendChild(el("span", "chip new", "New"));
      head.appendChild(el("span", "chip", TYPES[it.type]));
      head.appendChild(el("h2", "", it.title));
      const tm = el("time", "", when(it.ms)); tm.dateTime = new Date(it.ms).toISOString();
      li.append(head, tm);
      if (it.body) li.appendChild(el("p", "", it.body));
      if (it.guides.length) {
        const row = el("div");
        for (const g of it.guides) row.appendChild(el("span", "gch", names[g] || g));
        li.appendChild(row);
      }
      ol.appendChild(li);
    }
    box.appendChild(ol);
  }

  const z = zone();
  if (z) tzNote.textContent = "What changed in Study Quest, newest first. Times are shown in your time zone (" + z.replace(/_/g, " ") + ").";
  let prevSeen = -Infinity;
  try { const s = localStorage.getItem(SEEN); if (goodTime(s)) prevSeen = Date.parse(s); } catch (e) { /* storage blocked */ }

  const getJson = (u) => fetch(u, { cache: "no-cache", credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  Promise.all([
    getJson("updates.json"),
    getJson("guides.json").then((l) => { const m = {}; if (Array.isArray(l)) for (const g of l.slice(0, 60)) if (g && typeof g.id === "string" && typeof g.name === "string") m[g.id] = g.name.slice(0, 60); return m; }).catch(() => ({}))
  ]).then(([j, names]) => {
    const items = clean(j);
    if (!items) throw new Error("bad format");
    render(items, names, prevSeen);
    if (items.length) { try { localStorage.setItem(SEEN, new Date(items[0].ms).toISOString()); } catch (e) { /* storage blocked */ } }
  }).catch(() => {
    box.textContent = "";
    box.appendChild(el("p", "mut", "The updates list could not be loaded. Check your connection and reload the page."));
  });
})();
