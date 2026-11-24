/* Study Quest: readable math (loaded by boot.js for any guide whose content has math symbols).
   Content stays plain text. This file rewrites the text on the page with DOM nodes (never innerHTML):
   Σ_{i=1}^{n} or Σ(i=1 to n) becomes a sum with its limits below and above, x^(k+1) a superscript, a_k a subscript,
   and it lists what the symbols on a page mean. Format: tools/CONTENT-FORMAT.md, "Math". */
(function () {
  "use strict";
  var MEAN = [["∈", "is an element of (is in)"], ["∉", "is not an element of"], ["⊆", "is a subset of"], ["⊈", "is not a subset of"],
    ["∪", "union: in one set or the other, or both"], ["∩", "intersection: in both sets"], ["∅", "the empty set (no elements)"],
    ["∀", "for all"], ["∃", "there exists"], ["∋", "such that"], ["⇒", "implies (if … then)"], ["⇔", "if and only if"],
    ["→", "goes to: f: X → Y maps X to Y; p → q means if p then q"], ["∘", "composed with: (g ∘ f)(x) = g(f(x))"], ["⁻¹", "inverse (or reciprocal)"],
    ["Σ", "sum: add the terms, from the bottom value to the top value"], ["Π", "product: multiply the terms, from the bottom value to the top value"],
    ["≠", "is not equal to"], ["≤", "is less than or equal to"], ["≥", "is greater than or equal to"], ["≡", "is identical to or congruent to"], ["√", "square root"], ["~", "not"],
    ["ℤ", "the integers"], ["ℚ", "the rational numbers"], ["ℝ", "the real numbers"], ["ℕ", "the natural numbers"], ["⋯", "and so on"], ["∎", "end of proof"]];
  var SUM = "([ΣΠ])(?:_\\{([^{}]*)\\}(?:\\^(?:\\{([^{}]*)\\}|([A-Za-z0-9])))?|\\(([a-z] ?= ?(?:[^()]|\\([^()]*\\))*?) to ((?:[^()]|\\([^()]*\\))+)\\))";
  var SCR = "([_^])(?:\\{([^{}]*)\\}|\\(((?:[^()]|\\([^()]*\\))*)\\)|([−-]?(?:[0-9]+|[A-Za-z])|\\|[A-Za-z]\\|))";
  var TOKEN = new RegExp(SUM + "|" + SCR + "|([∈∉⊆⊈∪∩∅∀∃∋⇒⇔∘≠≤≥≡√ℤℚℝℕ])", "g"), QUICK = /[ΣΠ_^∈∉⊆⊈∪∩∅∀∃∋⇒⇔∘≠≤≥≡√ℤℚℝℕ]/;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.appendChild(build(text)); return e; }
  function hidden(t) { var h = document.createElement("span"); h.className = "mx-vh"; h.textContent = t; return h; }
  /* plain text -> nodes */
  function build(text) {
    var f = document.createDocumentFragment(), at = 0, m, re = new RegExp(TOKEN.source, "g"); text = String(text);
    while ((m = re.exec(text))) {
      if (m[7] && !/[\p{L}\p{N})\]}]/u.test(text.charAt(m.index - 1))) continue; /* a lone _ or ^ is not a script */
      if (m.index > at) f.appendChild(document.createTextNode(text.slice(at, m.index)));
      at = m.index + m[0].length;
      if (m[1]) {
        var lo = m[2] != null ? m[2] : m[5], hi = m[3] != null ? m[3] : m[4] != null ? m[4] : m[6], s = el("span", "mx-sum"), big = document.createElement("span");
        s.setAttribute("role", "math"); s.setAttribute("aria-label", (m[1] === "Σ" ? "the sum" : "the product") + (hi != null ? " from " + lo + " to " + hi + " of" : " over " + lo + " of"));
        if (hi != null) s.appendChild(el("span", "mx-lim", hi));
        big.className = "mx-big"; big.textContent = m[1]; s.appendChild(big);
        s.appendChild(el("span", "mx-lim", lo)); f.appendChild(s);
      } else if (m[7]) {
        /* the hidden ^( ) keeps it readable for screen readers and when copied */
        f.appendChild(hidden(m[7] + "(")); f.appendChild(el(m[7] === "^" ? "sup" : "sub", "mx-scr", m[8] != null ? m[8] : m[9] != null ? m[9] : m[10])); f.appendChild(hidden(")"));
      } else { var y = document.createElement("span"); y.className = "mx-s"; y.textContent = m[11]; f.appendChild(y); }
    }
    if (at < text.length) f.appendChild(document.createTextNode(text.slice(at)));
    return f;
  }
  var SKIP = "script,style,textarea,input,select,svg,[class^='mx-']:not(.mx-det)";
  function one(n) { var p = n.parentElement; if (!p || !QUICK.test(n.data) || p.closest(SKIP)) return; var f = build(n.data); if (f.firstElementChild) n.replaceWith(f); /* unchanged text stays: replacing it would wake the observer forever */ }
  function apply(root) {
    if (root.nodeType === 3) { one(root); return; }
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [], n;
    while ((n = w.nextNode())) if (QUICK.test(n.data)) list.push(n);
    list.forEach(one);
  }
  function details(text, label) {
    var rows = MEAN.filter(function (r) { return text.indexOf(r[0]) >= 0; }); if (!rows.length) return null;
    var d = document.createElement("details"), s = document.createElement("summary"), k = document.createElement("dl");
    d.className = "mx-det"; s.textContent = label; k.className = "mx-k";
    rows.forEach(function (r) { var b = document.createElement("div"), t = document.createElement("dt"), x = document.createElement("dd"); t.textContent = r[0]; x.textContent = r[1]; b.append(t, x); k.appendChild(b); });
    d.append(s, k); return d;
  }
  /* meanings go under each proof and at the end of study pages and results; never during a quiz, where they would give answers away */
  function keys() {
    document.querySelectorAll("#main .px-ans,#main .px-proof").forEach(function (a) {
      if (a.querySelector(".mx-det")) return; var d = details(a.textContent, "🔣 What the symbols mean"); if (d) a.appendChild(d);
    });
    var v = document.body.dataset.view, pg = document.querySelector("#main .page");
    if (!pg || (v !== "study" && v !== "res") || pg.querySelector(":scope>.mx-page")) return;
    var d = details(pg.textContent, "🔣 What the symbols on this page mean"); if (d) { d.className += " mx-page card"; pg.appendChild(d); }
  }
  window.CSQ_MATH = Object.freeze({ apply: apply });
  apply(document.body); keys();
  new MutationObserver(function (ms) {
    var main = false;
    ms.forEach(function (m) {
      if (m.target.closest && m.target.closest("#main")) main = true;
      m.addedNodes.forEach(function (n) { if (n.isConnected) apply(n); });
    });
    if (main) keys();
  }).observe(document.body, { childList: true, subtree: true });
})();
