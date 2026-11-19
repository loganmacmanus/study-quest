/* Study Quest hub: a gentle, original bossa-lounge "elevator" loop made with WebAudio (no audio files, nothing downloaded).
   Eight bars at 116 bpm: a soft electric-piano comp, a walking bossa bass, a quiet shaker and rim click, and a sparse vibraphone tune.
   The chords, rhythm and tune are written here from scratch; it is not a copy of any song.
   Rules: starts only after the first user gesture (browsers block audio before that), very low volume, obeys the global
   mute (sq_prefs.mute) and the hub music switch (sq_prefs.hubmus), and stops while the tab is hidden. */
(function () {
  "use strict";
  const AC0 = window.AudioContext || window.webkitAudioContext;
  const none = Object.freeze({ arm() {}, sync() {}, playing: () => false, state: () => "none", supported: false });
  if (!AC0) { window.SQ_HUBMUS = none; return; }

  const BPM = 116, E8 = 60 / BPM / 2, LEVEL = 0.13; // one eighth note; master volume (kept low on purpose)
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // bar = 8 eighth notes. root = bass note; v = comp voicing; mel = [step, midi, length in steps]
  const BARS = [
    { root: 41, v: [57, 60, 64, 67], mel: [[0, 76, 3], [3, 72, 1], [4, 74, 3]] },            // Fmaj9
    { root: 40, v: [55, 59, 62, 67], mel: [[2, 74, 3], [6, 71, 2]] },                         // Em7
    { root: 38, v: [57, 60, 64, 65], mel: [[0, 72, 3], [4, 69, 2], [6, 65, 2]] },             // Dm9
    { root: 43, v: [59, 64, 65, 69], mel: [[0, 71, 3], [4, 69, 4]] },                         // G13
    { root: 48, v: [59, 62, 64, 67], mel: [[0, 72, 4], [4, 76, 2], [6, 79, 2]] },             // Cmaj9
    { root: 45, v: [55, 61, 65], mel: [[0, 77, 3], [4, 73, 4]] },                             // A7(b13)
    { root: 38, v: [60, 64, 65, 69], mel: [[0, 74, 3], [4, 72, 2], [6, 69, 2]] },             // Dm7
    { root: 43, v: [59, 62, 65, 67], mel: [[0, 71, 2], [2, 74, 2], [4, 77, 2], [6, 74, 2]] }  // G7
  ];
  const COMP_A = [0, 3, 6], COMP_B = [0, 3, 4, 7], CLAVE = [0, 3, 6, 10, 13];

  let ctx = null, master = null, bus = null, noise = null, timer = 0, nextT = 0, step = 0, on = false, armed = false, gestured = false, token = 0;

  function build() {
    if (ctx) return;
    ctx = new AC0();
    master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    bus = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.4;
    bus.connect(lp); lp.connect(master);
    // a little room: one soft feedback echo
    const dl = ctx.createDelay(1); dl.delayTime.value = E8 * 3; const fb = ctx.createGain(); fb.gain.value = 0.26; const wet = ctx.createGain(); wet.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 1500;
    bus.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(master);
    const len = Math.floor(ctx.sampleRate * 0.05), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    noise = buf;
  }

  function tone(f, t, dur, type, g, atk, dest) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    a.gain.setValueAtTime(0.0001, t); a.gain.linearRampToValueAtTime(g, t + atk); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); a.connect(dest || bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function shaker(t, g) {
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), a = ctx.createGain();
    s.buffer = noise; hp.type = "highpass"; hp.frequency.value = 6000; a.gain.value = g;
    s.connect(hp); hp.connect(a); a.connect(bus); s.start(t);
  }

  function play(i, t) {
    const bar = Math.floor(i / 8), s = i % 8, c = BARS[bar];
    // soft electric piano comp on the bossa hits
    if ((bar % 2 ? COMP_B : COMP_A).includes(s)) c.v.forEach((m, k) => { tone(mtof(m), t + k * 0.008, E8 * 2.6, "triangle", 0.05, 0.01); tone(mtof(m) * 2, t + k * 0.008, E8 * 1.4, "sine", 0.012, 0.008); });
    // bass: root, fifth, root
    if (s === 0) tone(mtof(c.root), t, E8 * 3, "sine", 0.17, 0.012);
    else if (s === 3) tone(mtof(c.root + 7), t, E8 * 2, "sine", 0.13, 0.012);
    else if (s === 6) tone(mtof(c.root + 12), t, E8 * 1.6, "sine", 0.09, 0.012);
    // shaker on every eighth (accent on the beat) and a quiet rim click on the clave
    shaker(t, s % 2 ? 0.012 : 0.022);
    if (CLAVE.includes((bar % 2) * 8 + s)) tone(1180, t, 0.05, "triangle", 0.03, 0.002);
    // vibraphone tune
    c.mel.forEach(([st, m, len]) => { if (st === s) { const f = mtof(m), d = E8 * len * 1.7; tone(f, t, d, "sine", 0.075, 0.006); tone(f * 3.99, t, d * 0.35, "sine", 0.012, 0.004); } });
  }
  function sched() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.3) { play(step, nextT); nextT += E8; step = (step + 1) % (BARS.length * 8); }
  }

  function start() {
    if (on) return;
    try { build(); } catch (e) { ctx = null; return; }
    on = true; const my = ++token;
    try { if (ctx.state === "suspended") ctx.resume(); } catch (e) { /* no audio device */ }
    if (!timer) { nextT = ctx.currentTime + 0.12; step = Math.ceil(step / 8) * 8 % (BARS.length * 8); timer = setInterval(sched, 60); }
    const g = master.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(g.value, 0.0001), now); g.linearRampToValueAtTime(LEVEL, now + 1.6);
    void my;
  }
  function stop() {
    if (!on) return;
    on = false; const my = ++token;
    if (!ctx) return;
    const g = master.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(g.value, 0.0001), now); g.linearRampToValueAtTime(0.0001, now + 0.35);
    setTimeout(() => { if (token !== my || on) return; clearInterval(timer); timer = 0; try { ctx.suspend(); } catch (e) { /* ignore */ } }, 450);
  }

  function prefs() {
    try { const o = JSON.parse(localStorage.getItem("sq_prefs")); if (o && typeof o === "object") return { mute: o.mute === 1 || o.mute === true, hubmus: !(o.hubmus === 0 || o.hubmus === false) }; } catch (e) { /* defaults */ }
    return { mute: false, hubmus: true };
  }
  const wanted = () => { const p = prefs(); return p.hubmus && !p.mute; };
  function sync() { if (armed && gestured && wanted() && !document.hidden) start(); else stop(); }

  const gest = () => { gestured = true; ["pointerdown", "keydown", "touchend", "click"].forEach((t) => removeEventListener(t, gest, true)); sync(); };
  ["pointerdown", "keydown", "touchend", "click"].forEach((t) => addEventListener(t, gest, { capture: true, passive: true }));
  addEventListener("sq-prefs", sync);
  addEventListener("storage", (e) => { if (e.key === "sq_prefs" || e.key === null) sync(); });
  document.addEventListener("visibilitychange", sync);
  addEventListener("pagehide", stop);

  window.SQ_HUBMUS = Object.freeze({ arm() { armed = true; sync(); }, sync, playing: () => on, state: () => (ctx ? ctx.state : "none"), supported: true });
})();
