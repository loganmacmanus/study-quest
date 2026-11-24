/* ===== Study Quest: Proofs tab (Workshop, Proof Builder, Counterexamples, Find the Error). =====
   Loaded only for guides whose content file has an "X" object (boot.js sets window.X before app.js).
   No eval, no Function, no unescaped HTML: every string goes through api.esc, and the counterexample rules
   are run by a tiny parser for a fixed expression grammar (see tools/CONTENT-FORMAT.md, section X). */
(function () {
  "use strict";

  /* ---------- expression language (must match tools/validate-content.py exactly) ----------
     numbers 12, 0.5 | field variables [a-z][a-z0-9]{0,3} | + - * / % ^ (^ right-assoc) | unary - ! |
     == != < <= > >= (tolerance 1e-9) | && || (short-circuit, results 1/0) | ( ) |
     mod(a,b) abs(a) isint(a) min(a,b) max(a,b). Anything else is a parse error. */
  var MAX_LEN = 300, MAX_DEPTH = 40, EPS = 1e-9;
  var FNS = new Map([["mod", 2], ["abs", 1], ["isint", 1], ["min", 2], ["max", 2]]);
  var TOK = /[ \t\r\n]*(?:(\d+(?:\.\d+)?)|([A-Za-z][A-Za-z0-9]*)|(==|!=|<=|>=|&&|\|\||[-+*\/%^<>!(),]))/y;

  function tokenize(src) {
    if (typeof src !== "string" || src.length === 0 || src.length > MAX_LEN) throw new Error("bad length");
    var out = [], pos = 0, m;
    TOK.lastIndex = 0;
    while (pos < src.length) {
      if (/^[ \t\r\n]*$/.test(src.slice(pos))) break;
      TOK.lastIndex = pos;
      m = TOK.exec(src);
      if (!m) throw new Error("bad character");
      pos = TOK.lastIndex;
      if (m[1] !== undefined) out.push({ t: "n", v: parseFloat(m[1]) });
      else if (m[2] !== undefined) out.push({ t: "i", v: m[2] });
      else out.push({ t: "o", v: m[3] });
      if (out.length > 200) throw new Error("too long");
    }
    return out;
  }

  function parse(src, vars) {
    var toks = tokenize(src), i = 0, depth = 0;
    var peek = function () { return toks[i]; };
    var isOp = function (v) { var t = toks[i]; return t && t.t === "o" && t.v === v; };
    var eat = function (v) { if (!isOp(v)) throw new Error("expected " + v); i++; };
    var down = function () { if (++depth > MAX_DEPTH) throw new Error("too deep"); };
    var up = function () { depth--; };
    function bin(next, ops) {
      return function () {
        var a = next();
        for (;;) {
          var t = peek();
          if (t && t.t === "o" && ops.indexOf(t.v) >= 0) { i++; a = { k: "b", op: t.v, a: a, b: next() }; } else return a;
        }
      };
    }
    function primary() {
      var t = peek();
      if (!t) throw new Error("unexpected end");
      if (t.t === "n") { i++; return { k: "n", v: t.v }; }
      if (t.t === "i") {
        i++;
        if (isOp("(")) {
          if (!FNS.has(t.v)) throw new Error("unknown function");
          i++;
          var args = [];
          if (!isOp(")")) { for (;;) { args.push(orE()); if (isOp(",")) { i++; continue; } break; } }
          eat(")");
          if (args.length !== FNS.get(t.v)) throw new Error("arity");
          return { k: "f", name: t.v, args: args };
        }
        if (!vars.has(t.v)) throw new Error("unknown name");
        return { k: "v", name: t.v };
      }
      if (t.t === "o" && t.v === "(") { i++; down(); var e = orE(); up(); eat(")"); return e; }
      throw new Error("unexpected token");
    }
    function unary() {
      var t = peek();
      if (t && t.t === "o" && (t.v === "-" || t.v === "!")) { i++; down(); var a = unary(); up(); return { k: "u", op: t.v, a: a }; }
      return power();
    }
    function power() {
      var a = primary();
      if (isOp("^")) { i++; down(); var b = unary(); up(); return { k: "b", op: "^", a: a, b: b }; }
      return a;
    }
    var mul = bin(unary, ["*", "/", "%"]), add = bin(mul, ["+", "-"]), rel = bin(add, ["<", "<=", ">", ">="]),
      eq = bin(rel, ["==", "!="]), andE = bin(eq, ["&&"]);
    function orE() { down(); var r = bin(andE, ["||"])(); up(); return r; }
    var ast = orE();
    if (i !== toks.length) throw new Error("trailing input");
    return ast;
  }

  function modulus(a, b) { if (b === 0) throw new Error("mod by zero"); return a - b * Math.floor(a / b); }
  function fin(x) { if (typeof x !== "number" || !isFinite(x)) throw new Error("not finite"); return x; }
  function ev(n, env) {
    switch (n.k) {
      case "n": return n.v;
      case "v": return env.get(n.name);
      case "u": { var a = ev(n.a, env); return n.op === "-" ? -a : (a === 0 ? 1 : 0); }
      case "f": {
        var x = n.args.map(function (s) { return ev(s, env); });
        switch (n.name) {
          case "mod": return fin(modulus(x[0], x[1]));
          case "abs": return Math.abs(x[0]);
          case "isint": return Math.abs(x[0] - Math.round(x[0])) < EPS ? 1 : 0;
          case "min": return Math.min(x[0], x[1]);
          default: return Math.max(x[0], x[1]);
        }
      }
      default: {
        if (n.op === "&&") return ev(n.a, env) !== 0 && ev(n.b, env) !== 0 ? 1 : 0;
        if (n.op === "||") return ev(n.a, env) !== 0 || ev(n.b, env) !== 0 ? 1 : 0;
        var p = ev(n.a, env), q = ev(n.b, env), same = Math.abs(p - q) <= EPS;
        switch (n.op) {
          case "+": return fin(p + q);
          case "-": return fin(p - q);
          case "*": return fin(p * q);
          case "/": if (q === 0) throw new Error("division by zero"); return fin(p / q);
          case "%": return fin(modulus(p, q));
          case "^": return fin(Math.pow(p, q));
          case "==": return same ? 1 : 0;
          case "!=": return same ? 0 : 1;
          case "<": return p < q && !same ? 1 : 0;
          case "<=": return p < q || same ? 1 : 0;
          case ">": return p > q && !same ? 1 : 0;
          default: return p > q || same ? 1 : 0;
        }
      }
    }
  }

  var cache = new Map();
  function compile(src, names) {
    var key = names.join(",") + "|" + src, c = cache.get(key);
    if (c === undefined) {
      try { c = parse(src, new Set(names)); } catch (e) { c = null; }
      cache.set(key, c);
    }
    return c;
  }
  /* returns a number, or null when the expression is invalid or fails (division by zero, overflow) */
  function run(src, names, values) {
    var ast = compile(src, names);
    if (!ast) return null;
    var env = new Map();
    names.forEach(function (nm, k) { env.set(nm, values[k]); });
    try { return fin(ev(ast, env)); } catch (e) { return null; }
  }
  function fmt(v) {
    if (v === null) return "?";
    if (Object.is(v, -0)) return "0";
    if (Number.isInteger(v)) return String(v);
    return String(parseFloat(v.toPrecision(6)));
  }
  /* {var} = typed value, {=expr} = evaluated expression; the result is plain text (escaped by the caller) */
  function template(tpl, names, values) {
    return String(tpl).replace(/\{(=?)([^{}]*)\}/g, function (all, eqs, body) {
      if (eqs) return fmt(run(body, names, values));
      var k = names.indexOf(body);
      return k >= 0 ? String(values[k]) : all;
    });
  }

  /* ---------- UI ---------- */
  var SUBS = [["ws", "📝 Workshop"], ["pb", "🧩 Proof Builder"], ["ce", "🔍 Counterexamples"], ["er", "🐞 Find the Error"]];
  var st = { sub: "ws", outline: false, rev: {}, b: null, c: {}, e: {} , ei: 0 };
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var isArr = Array.isArray;
  var doneTag = function () { var t = document.createElement("span"); t.className = "tag px-done"; t.textContent = "✓ done"; return t; };

  /* proofs read down the page: a step label, then one sentence per line, and a chain a = b = c with one "=" per line.
     Spans, not divs, so the same layout works inside answer buttons. Every piece goes through esc. */
  function chain(s) {
    var parts = [], depth = 0, from = 0, k;
    for (k = 0; k < s.length; k++) {
      var ch = s.charAt(k);
      if ("([{".indexOf(ch) >= 0) depth++; else if (")]}".indexOf(ch) >= 0) depth = Math.max(0, depth - 1);
      else if (!depth && "=<≤>≥".indexOf(ch) >= 0 && (k === 0 || s.charAt(k - 1) === " ") && s.charAt(k + 1) === " ") { parts.push(s.slice(from, k)); from = k; }
    }
    parts.push(s.slice(from));
    if (parts.length < 3 || (parts.length === 3 && s.length < 45 && /[A-Za-z]{3,}/.test(parts[0])) || parts.slice(1, -1).some(function (p) { return /[A-Za-z]{3,}|, |: /.test(p.replace(/\([^()]*\)/g, "")); })) return [s];
    return parts.map(function (p) { return p.trim(); }).filter(Boolean);
  }
  function lineHTML(text, esc) {
    var t = String(text), lab = /^((?:Step|Basis|Inductive|Case|Part|Proof|Conclusion|To show|Show)\b[^:.=]{0,40}):\s+/.exec(t), out = "";
    if (lab) { out += '<span class="px-step">' + esc(lab[1]) + "</span>"; t = t.slice(lab[0].length); }
    t.replace(/, (?=where [a-zA-Z] = )/g, ",\n").replace(/([0-9)])\.\s+(?=[0-9])/g, "$1.\n").replace(/([.:])\s+(?=[A-ZΣΠ("“∀∃])/g, function (a, c, at, all) { return c === ":" && /(^|\W)[A-Za-z]$/.test(all.slice(0, at)) ? a : c + "\n"; }).split("\n").forEach(function (sen) {
      chain(sen).forEach(function (p) {
        var why = /\s+(\((?=[a-z][a-z ]{4,})[^()]*\))(\.?)$/.exec(p), b = why ? p.slice(0, why.index) : p;
        out += '<span class="px-ln' + (/^[=<≤>≥] /.test(b) ? " px-eq" : "") + '">' + esc(b) + (why ? ' <span class="px-why">' + esc(why[1]) + "</span>" + why[2] : "") + "</span> ";
      });
    });
    return out;
  }

  function render(api) {
    var X = window.X || {}, esc = api.esc, main = api.main;
    var px = (api.state.px = api.state.px && typeof api.state.px === "object" && !isArr(api.state.px) ? api.state.px : {});
    var sel = api.sel(), all = sel.indexOf("all") >= 0;
    var inSel = function (it) { return all || sel.indexOf(String(it.ch)) >= 0; };
    var list = function (k) { return (isArr(X[k]) ? X[k] : []).filter(function (it) { return it && typeof it === "object" && inSel(it); }); };
    var idOf = function (pre, it, n) { return (pre + (typeof it.id === "string" && it.id ? it.id : String(n))).slice(0, 40); };
    var mark = function (key) {
      if (px[key] || Object.keys(px).length >= 500) return false;
      px[key] = 1; api.save(); return true;
    };
    var xp = function (n, key, ev, btn) {
      if (!mark(key)) return;
      var x = ev && ev.clientX, y = ev && ev.clientY;
      if (btn && (!x || !y)) { var r = btn.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
      api.addXP(n, x, y);
    };
    var tag = function (it) { return '<span class="tag">' + esc(api.chName(String(it.ch))) + '</span><span class="tag">' + esc(it.src || "") + "</span>"; };
    var empty = '<div class="card"><p class="mut">Nothing for these sections yet. Pick another section chip above.</p></div>';
    var paint = function (html, bind) { main.innerHTML = html; if (bind) bind(); };
    var focusEl = function (sel2) { var el = main.querySelector(sel2); if (el) { el.focus({ preventScroll: false }); } };

    /* header: outline + sub tabs */
    var o = X.outline && typeof X.outline === "object" ? X.outline : null;
    var head = "";
    if (o) {
      head += '<div class="card px-outline"><button type="button" class="btn s g" id="px-ol" aria-expanded="' + st.outline + '" aria-controls="px-olb">📋 ' + esc(o.title || "Test outline") + " " + (st.outline ? "▲" : "▼") + '</button><div id="px-olb"' + (st.outline ? "" : " hidden") + ">";
      if (o.coverage) head += '<p class="mut">' + esc(o.coverage) + "</p>";
      head += '<ul class="px-ol">' + (isArr(o.rows) ? o.rows : []).map(function (r) { r = isArr(r) ? r : []; var t = function (k) { return esc(r[k] == null ? "" : r[k]); };
        return '<li class="px-olr"><div class="px-olq">Q' + t(0) + '</div><div class="px-olt">' + t(1) + '</div><div class="px-olp"><span class="tag">' + t(2) + '</span><b>' + t(3) + "</b></div></li>"; }).join("") + "</ul>";
      if (o.note) head += '<p class="mut">' + esc(o.note) + "</p>";
      head += "</div></div>";
    }
    head += '<div class="tog px-tog" role="tablist" aria-label="Proofs sections">' + SUBS.map(function (s) { return '<button type="button" role="tab" aria-selected="' + (st.sub === s[0]) + '" class="' + (st.sub === s[0] ? "on" : "") + '" data-sb="' + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div>";

    var items = list({ ws: "workshop", pb: "builder", ce: "counter", er: "errors" }[st.sub]);
    var body = "", after = null;

    if (st.sub === "ws") {
      body += '<p class="mut px-count">' + items.length + " sample proof" + (items.length === 1 ? "" : "s") + ". Write it by hand first, then check.</p>";
      body += items.length ? items.map(function (it, n) {
        var id = idOf("w", it, n), open = !!st.rev[id], done = !!px[id];
        return '<div class="card px-card"><div>' + tag(it) + (done ? '<span class="tag px-done">✓ done</span>' : "") + "</div><h3>" + esc(it.title || "") + "</h3><p>" + esc(it.prompt || "") + '</p><div class="px-row"><button type="button" class="btn s g" data-rev="' + n + '" aria-expanded="' + open + '">' + (open ? "Hide answer" : "Show full answer") + '</button><button type="button" class="btn s" data-got="' + n + '"' + (done ? " disabled" : "") + ">I got it ✓</button></div>"
          + '<div class="px-ans" data-ans="' + n + '"' + (open ? "" : " hidden") + ">" + (isArr(it.answer) ? it.answer : []).map(function (l) { return '<div class="px-line">' + lineHTML(l, esc) + "</div>"; }).join("") + "</div></div>";
      }).join("") : empty;
      after = function () {
        main.querySelectorAll("[data-rev]").forEach(function (b) {
          b.onclick = function () {
            var n = +b.dataset.rev, it = items[n], id = idOf("w", it, n), box = main.querySelector('[data-ans="' + n + '"]');
            st.rev[id] = !st.rev[id]; box.hidden = !st.rev[id]; b.setAttribute("aria-expanded", String(!!st.rev[id])); b.textContent = st.rev[id] ? "Hide answer" : "Show full answer"; api.sfx.click();
          };
        });
        main.querySelectorAll("[data-got]").forEach(function (b) {
          b.onclick = function (ev) { var n = +b.dataset.got; api.sfx.ok(); xp(5, idOf("w", items[n], n), ev, b); b.disabled = true; var c = b.closest(".px-card"); if (c && !c.querySelector(".px-done")) c.firstChild.appendChild(doneTag()); };
        });
      };
    } else if (st.sub === "pb") {
      body += '<p class="mut px-count">' + items.length + " proof" + (items.length === 1 ? "" : "s") + ". Build each line by choosing the right step.</p>";
      if (!items.length) body += empty;
      else {
        if (!st.b || !items.some(function (it, n) { return idOf("b", it, n) === st.b.id; })) st.b = { id: idOf("b", items[0], 0), stage: 0, lines: [], bad: [], order: null, msg: "" };
        var bi = items.findIndex(function (it, n) { return idOf("b", it, n) === st.b.id; }), it = items[bi], stages = isArr(it.stages) ? it.stages : [];
        body += '<div class="px-pick">' + items.map(function (p, n) { var id = idOf("b", p, n); return '<button type="button" class="btn s ' + (id === st.b.id ? "" : "g") + '" data-pk="' + n + '" aria-pressed="' + (id === st.b.id) + '">' + (px[id] ? "✓ " : "") + esc(p.title || "") + "</button>"; }).join("") + "</div>";
        body += '<div class="card px-card"><div>' + tag(it) + '</div><p class="px-stmt"><b>' + esc(it.statement || "") + "</b></p>";
        if (st.b.lines.length) body += '<div class="px-proof">' + st.b.lines.map(function (l) { return '<div class="px-line">' + lineHTML(l, esc) + "</div>"; }).join("") + (st.b.stage >= stages.length ? '<div class="px-qed" aria-label="end of proof">∎</div>' : "") + "</div>";
        if (st.b.stage < stages.length) {
          var sg = stages[st.b.stage], opts = [{ t: sg.correct, ok: true }].concat((isArr(sg.wrong) ? sg.wrong : []).map(function (w) { return { t: w[0], why: w[1], ok: false }; }));
          if (!st.b.order || st.b.order.length !== opts.length) st.b.order = shuffle(opts.map(function (_, k) { return k; }));
          body += '<p class="px-prompt" id="px-prompt" tabindex="-1"><b>' + esc(sg.prompt || "") + "</b> <span class=\"mut\">(step " + (st.b.stage + 1) + " of " + stages.length + ")</span></p>";
          body += st.b.order.map(function (oi, k) { var bad = st.b.bad.indexOf(oi) >= 0; return '<button type="button" class="opt' + (bad ? " no" : "") + '" data-o="' + oi + '"' + (bad ? " disabled" : "") + "><i>" + "ABCDEF"[k] + "</i><span>" + lineHTML(opts[oi].t, esc) + "</span></button>"; }).join("");
          body += '<div class="fb px-fb" id="px-fb" tabindex="-1" aria-live="polite"' + (st.b.msg ? "" : " hidden") + ">" + esc(st.b.msg) + "</div>";
          after = function () {
            main.querySelectorAll("[data-o]").forEach(function (b) {
              b.onclick = function (ev) {
                var oi = +b.dataset.o, op = opts[oi];
                if (op.ok) {
                  api.sfx.ok(); st.b.lines.push(sg.correct); xp(2, (idOf("b", it, bi) + ":" + st.b.stage).slice(0, 40), ev, b);
                  st.b.stage++; st.b.bad = []; st.b.order = null; st.b.msg = "";
                  if (st.b.stage >= stages.length) mark(idOf("b", it, bi));
                  api.rerender(); focusEl("#px-prompt, #px-fb");
                } else {
                  api.sfx.bad(); st.b.bad.push(oi); st.b.msg = "✗ Not this one. " + String(op.why || "");
                  paint0();
                }
              };
            });
          };
        } else {
          body += '<div class="fb good px-fb" id="px-fb" tabindex="-1" aria-live="polite">✓ Proof complete. Read it top to bottom once more.</div><div class="px-row"><button type="button" class="btn s g" id="px-again">Start over</button><button type="button" class="btn s" id="px-next">Next proof</button></div>';
          after = function () {
            main.querySelector("#px-again").onclick = function () { api.sfx.click(); st.b = { id: st.b.id, stage: 0, lines: [], bad: [], order: null, msg: "" }; api.rerender(); };
            main.querySelector("#px-next").onclick = function () { api.sfx.click(); var nx = items[(bi + 1) % items.length]; st.b = { id: idOf("b", nx, (bi + 1) % items.length), stage: 0, lines: [], bad: [], order: null, msg: "" }; api.rerender(); };
          };
        }
        body += "</div>";
        var base = after;
        after = function () {
          if (base) base();
          main.querySelectorAll("[data-pk]").forEach(function (b) {
            b.onclick = function () { var n = +b.dataset.pk; api.sfx.click(); st.b = { id: idOf("b", items[n], n), stage: 0, lines: [], bad: [], order: null, msg: "" }; api.rerender(); };
          });
        };
      }
    } else if (st.sub === "ce") {
      body += '<p class="mut px-count">' + items.length + " claim" + (items.length === 1 ? "" : "s") + ". Whole numbers only (negatives are fine).</p>";
      body += items.length ? items.map(function (it, n) {
        var id = idOf("c", it, n), s = st.c[id] || {}, fl = isArr(it.fields) ? it.fields : [];
        return '<div class="card px-card"><div>' + tag(it) + (px[id] ? '<span class="tag px-done">✓ done</span>' : "") + "</div><p><b>" + esc(it.claim || "") + '</b></p><div class="px-row">'
          + fl.map(function (f, k) { return '<label class="px-lab">' + esc(f[1] || f[0]) + ' <input class="px-in" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="9" data-c="' + n + '" data-f="' + k + '" value="' + esc(s.v && s.v[k] != null ? s.v[k] : "") + '"></label>'; }).join("")
          + '<button type="button" class="btn s" data-chk="' + n + '">Check</button><button type="button" class="btn s g" data-ex="' + n + '" aria-expanded="' + !!s.ex + '">Show an example</button></div>'
          + '<div class="fb px-fb' + (s.res ? (s.res.ok ? " good" : " badc") : "") + '" data-out="' + n + '" tabindex="-1" aria-live="polite"' + (s.res ? "" : " hidden") + ">" + (s.res ? esc(s.res.msg) : "") + "</div>"
          + '<div class="fb px-fb" data-exb="' + n + '"' + (s.ex ? "" : " hidden") + ">" + esc(it.example || "") + "</div></div>";
      }).join("") : empty;
      after = function () {
        main.querySelectorAll("[data-chk]").forEach(function (b) {
          b.onclick = function (ev) {
            var n = +b.dataset.chk, it = items[n], id = idOf("c", it, n), card = b.closest(".px-card"), fl = it.fields, names = fl.map(function (f) { return f[0]; });
            var raw = Array.prototype.map.call(card.querySelectorAll(".px-in"), function (inp) { return inp.value.trim(); });
            var s = (st.c[id] = st.c[id] || {}); s.v = raw;
            var out = card.querySelector("[data-out]"), res;
            var okNum = raw.every(function (r) { return /^-?\d{1,7}$/.test(r) && Math.abs(parseInt(r, 10)) <= 1e6; });
            if (!okNum) res = { ok: false, msg: "Enter a whole number in each box." };
            else {
              var vals = raw.map(function (r) { return parseInt(r, 10); });
              res = { ok: true, msg: template(it.ok || "Valid.", names, vals) };
              var rules = isArr(it.rules) ? it.rules : [];
              for (var k = 0; k < rules.length; k++) {
                if (run(String(rules[k][0]), names, vals) !== 1) { res = { ok: false, msg: template(rules[k][1] || "Not a counterexample.", names, vals) }; break; }
              }
              if (res.ok) { api.sfx.ok(); xp(3, id, ev, b); } else api.sfx.bad();
            }
            if (!okNum) api.sfx.bad();
            res.msg = (res.ok ? "✓ " : "✗ ") + res.msg; s.res = res;
            out.hidden = false; out.className = "fb px-fb " + (res.ok ? "good" : "badc"); out.textContent = res.msg; out.focus({ preventScroll: true });
            if (res.ok && !card.querySelector(".px-done")) card.firstChild.appendChild(doneTag());
          };
        });
        main.querySelectorAll("[data-ex]").forEach(function (b) {
          b.onclick = function () { var n = +b.dataset.ex, id = idOf("c", items[n], n), s = (st.c[id] = st.c[id] || {}); s.ex = !s.ex; b.setAttribute("aria-expanded", String(!!s.ex)); main.querySelector('[data-exb="' + n + '"]').hidden = !s.ex; api.sfx.click(); };
        });
        main.querySelectorAll(".px-in").forEach(function (inp) {
          inp.onkeydown = function (e) { if (e.key === "Enter") { var c = inp.closest(".px-card").querySelector("[data-chk]"); c.click(); } };
        });
      };
    } else {
      var tot = items.length;
      if (st.ei >= tot) st.ei = Math.max(0, tot - 1);
      body += '<p class="mut px-count">' + tot + " flawed proof" + (tot === 1 ? "" : "s") + ". Each has one real mistake.</p>";
      if (!tot) body += empty;
      else {
        var it2 = items[st.ei], eid = idOf("e", it2, st.ei), es = (st.e[eid] = st.e[eid] || { bad: [], solved: false, first: false });
        var answered = 0, right = 0;
        items.forEach(function (q, n) { var s2 = st.e[idOf("e", q, n)]; if (s2 && s2.solved) { answered++; if (s2.first) right++; } });
        body += '<p class="mut px-count" aria-live="polite">Score: ' + right + " / " + answered + " answered · item " + (st.ei + 1) + " of " + tot + "</p>";
        body += '<div class="card px-card"><div>' + tag(it2) + "</div><p><b>Claim:</b> " + esc(it2.claim || "") + '</p><div class="px-pre">' + (isArr(it2.fragment) ? it2.fragment : []).map(function (l) { return '<div class="px-line">' + lineHTML(l, esc) + "</div>"; }).join("") + "</div><p><b>" + esc(it2.q || "What is the main error?") + "</b></p>";
        body += (isArr(it2.options) ? it2.options : []).map(function (t, k) { var bad = es.bad.indexOf(k) >= 0, good = es.solved && k === it2.answer; return '<button type="button" class="opt' + (good ? " ok" : bad ? " no" : "") + '" data-a="' + k + '"' + (bad || es.solved ? " disabled" : "") + "><i>" + "ABCDE"[k] + "</i><span>" + esc(t) + "</span></button>"; }).join("");
        body += '<div class="fb px-fb' + (es.solved ? " good" : "") + '" id="px-fb" tabindex="-1" aria-live="polite"' + (es.solved || es.bad.length ? "" : " hidden") + ">" + (es.solved ? "✓ " + esc(it2.expl || "") : es.bad.length ? "✗ Not quite. Look at the proof again and try another option." : "") + "</div>";
        body += '<div class="px-row"><button type="button" class="btn s g" id="px-prev"' + (st.ei === 0 ? " disabled" : "") + '>← Previous</button><button type="button" class="btn s" id="px-nxt"' + (st.ei >= tot - 1 ? " disabled" : "") + ">Next →</button></div></div>";
        after = function () {
          main.querySelectorAll("[data-a]").forEach(function (b) {
            b.onclick = function (ev) {
              var k = +b.dataset.a;
              if (k === it2.answer) { api.sfx.ok(); es.solved = true; es.first = es.bad.length === 0; if (es.first) xp(3, eid, ev, b); }
              else { api.sfx.bad(); es.bad.push(k); }
              api.rerender(); focusEl("#px-fb");
            };
          });
          main.querySelector("#px-prev").onclick = function () { api.sfx.click(); st.ei--; api.rerender(); };
          main.querySelector("#px-nxt").onclick = function () { api.sfx.click(); st.ei++; api.rerender(); };
        };
      }
    }

    function paint0() { api.rerender(); focusEl("#px-fb"); }
    paint('<div class="page">' + head + body + "</div>", function () {
      var ob = main.querySelector("#px-ol");
      if (ob) ob.onclick = function () { st.outline = !st.outline; ob.setAttribute("aria-expanded", String(st.outline)); main.querySelector("#px-olb").hidden = !st.outline; ob.textContent = "📋 " + (o.title || "Test outline") + " " + (st.outline ? "▲" : "▼"); api.sfx.click(); };
      main.querySelectorAll("[data-sb]").forEach(function (b) { b.onclick = function () { st.sub = b.dataset.sb; api.sfx.click(); api.rerender(); }; });
      if (after) after();
    });
  }

  window.CSQ_PROOFS = Object.freeze({ render: render, _line: lineHTML, _expr: Object.freeze({ parse: function (s, names) { return compile(s, names) !== null; }, run: run, template: template, fmt: fmt }) });
})();
