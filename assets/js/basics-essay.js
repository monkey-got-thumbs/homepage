/* basics-essay.js — the interactive layer of "What comes next? — a field guide
   from 2050" (/basics/). One state object, pure compute, event-driven renders.
   Classic IIFE (site convention for explorable JS), CSP-safe, no backend: the
   n-gram toy's every probability is a count the reader can verify in the
   visible corpus. All teaching prose lives in the page/a11y JSON; this file
   owns only demo captions, tiered by reading level via the journey.js pattern
   (data-level MutationObserver). Inert on pages without its hooks. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  if (!$("fig-gate")) return; // not the essay page

  var esc = function (s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };

  // reading-level tier: 1-2 → 0 (narrated), 3 → 1 (terse confirm), 4-5 → 2 (open questions)
  function tier() {
    var lv = parseInt(document.documentElement.getAttribute("data-level") || "3", 10) || 3;
    return lv <= 2 ? 0 : lv === 3 ? 1 : 2;
  }

  /* ================= corpora ================= */

  var GATE_TEXT = "The monkey finds a tool. The monkey holds the tool. The monkey holds the branch. The tool slips once. The monkey holds the tool again.";
  var GATE_PROMPT_WORDS = ["practice", "is", "how", "the", "monkey", "holds", "the"];

  var CORPUS_TEXT = "The guide you are holding was written in a year you have not met. Where this guide comes from, every child learns one small truth early: a machine can guess the next word because people repeat themselves. We repeat ourselves by the river, and we repeat ourselves at the bank. The money sleeps in the bank at night. The river sleeps against the bank all summer. Only the word before tells you which bank has woken up. In my time the glasses on your face read the street signs aloud, and the little agents sort the morning mail before breakfast. The agents are not clever. The agents are careful. They take one step, they check the step, and they take the next step. The monkey with thumbs learnt the same trick long ago: hold the tool, check the grip, try again. The tools changed. The checking never did. A model is a guessing machine. The model read more pages than any person could read in a thousand lifetimes, and still the model cannot tell you what it did this morning, because the model only guesses. We let the model guess for us. Who keeps the deciding is the question my century still argues about at dinner. Some people lean on the machines hard. Some people barely touch the machines. The last chapter of this guide is blank because the next part is not mine to write. The next part is yours.";

  /* ================= n-gram core (unit-tested) ================= */

  function tokenize(text) { return String(text).toLowerCase().match(/[a-z']+|[.!?:]/g) || []; }

  function buildTables(tokens, maxOrder) {
    var tables = [];
    for (var n = 1; n <= maxOrder; n++) {
      var t = new Map();
      for (var i = n - 1; i < tokens.length - 1; i++) {
        var ctx = tokens.slice(i - n + 1, i + 1).join(" ");
        var m = t.get(ctx);
        if (!m) { m = new Map(); t.set(ctx, m); }
        var next = tokens[i + 1];
        m.set(next, (m.get(next) || 0) + 1);
      }
      tables.push(t);
    }
    return tables;
  }

  function nextDist(tables, ctxTokens, order) {
    for (var n = Math.min(order, ctxTokens.length, tables.length); n >= 1; n--) {
      var ctx = ctxTokens.slice(-n).join(" ");
      var m = tables[n - 1].get(ctx);
      if (m && m.size) {
        var total = 0; m.forEach(function (c) { total += c; });
        var items = [];
        m.forEach(function (c, w) { items.push({ w: w, c: c, p: c / total }); });
        items.sort(function (a, b) { return b.c - a.c || (a.w < b.w ? -1 : 1); });
        return { order: n, ctx: ctxTokens.slice(-n), items: items };
      }
    }
    return null;
  }

  function sample(items, T, rnd) {
    if (T <= 0.01) return items[0].w;
    var weights = items.map(function (it) { return Math.pow(it.p, 1 / T); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = rnd() * total;
    for (var i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i].w; }
    return items[items.length - 1].w;
  }

  function provenance(tokens, ctxTokens, word) {
    var n = ctxTokens.length, hits = [];
    for (var i = n - 1; i < tokens.length - 1; i++) {
      if (word !== null && tokens[i + 1] !== word) continue;
      var ok = true;
      for (var k = 0; k < n; k++) if (tokens[i - n + 1 + k] !== ctxTokens[k]) { ok = false; break; }
      if (ok) hits.push(i - n + 1);
    }
    return hits;
  }

  /* ================= shared state + trail ================= */

  var S = {
    mins: 12, wpm: 250, prep: 60,
    trail: { discover: [], explore: [], build: [] }
  };

  // captions re-render when the reading level changes (registered per demo)
  var CAPS = [];

  // innerHTML re-renders destroy focus; capture a stable selector and restore
  function withFocus(container, fn) {
    var a = document.activeElement;
    var sig = null;
    if (a && container.contains(a)) {
      sig = a.getAttribute("data-a") || a.getAttribute("data-w") || a.getAttribute("data-g") ||
            a.getAttribute("data-t") || a.getAttribute("data-r") || a.getAttribute("data-f") ||
            a.getAttribute("data-i") || a.getAttribute("data-m");
      sig = sig !== null ? [a.tagName, sig] : null;
    }
    fn();
    if (sig) {
      var again = container.querySelector(sig[0] + '[data-a="' + sig[1] + '"],' + sig[0] + '[data-w="' + sig[1] + '"],' + sig[0] + '[data-g="' + sig[1] + '"],' + sig[0] + '[data-t="' + sig[1] + '"],' + sig[0] + '[data-r="' + sig[1] + '"],' + sig[0] + '[data-f="' + sig[1] + '"],' + sig[0] + '[data-i="' + sig[1] + '"],' + sig[0] + '[data-m="' + sig[1] + '"]');
      if (again) again.focus();
    }
  }
  function trail(kind, label) {
    var list = S.trail[kind];
    if (list.indexOf(label) === -1) { list.push(label); renderTrail(); }
  }

  /* ================= corpus rendering + highlighting ================= */

  function renderCorpus(el, tokens) {
    el.innerHTML = tokens.map(function (t, i) {
      return '<span class="tk" data-i="' + i + '">' + esc(t) + "</span>";
    }).join(" ");
  }
  function highlight(el, hits, ctxLen) {
    el.querySelectorAll(".tk.hl, .tk.hl-ctx").forEach(function (n) { n.classList.remove("hl", "hl-ctx"); });
    hits.forEach(function (start) {
      for (var k = 0; k < ctxLen; k++) {
        var n = el.querySelector('.tk[data-i="' + (start + k) + '"]');
        if (n) n.classList.add("hl-ctx");
      }
      var w = el.querySelector('.tk[data-i="' + (start + ctxLen) + '"]');
      if (w) w.classList.add("hl");
    });
    var first = el.querySelector(".tk.hl");
    if (first && el.scrollHeight > el.clientHeight) first.scrollIntoView({ block: "nearest" });
  }

  function renderBars(el, dist, opts) {
    opts = opts || {};
    if (!dist) { el.innerHTML = ""; return; }
    var top = dist.items.slice(0, opts.max || 8);
    el.innerHTML = top.map(function (it) {
      var pct = Math.round(it.p * 100);
      var cls = "bar" + (opts.guess === it.w ? " guess" : "") + (opts.sel === it.w ? " sel" : "");
      return '<button type="button" class="' + cls + '" data-w="' + esc(it.w) + '" aria-label="' + esc(it.w) + ": seen " + it.c + " times, " + pct + '%">' +
        '<span class="w">' + esc(it.w) + '</span>' +
        '<span class="tr"><span class="fl" style="inline-size:' + pct + '%"></span></span>' +
        '<span class="p">' + it.c + "× · " + pct + "%</span></button>";
    }).join("");
    if (opts.missWord) {
      el.innerHTML += '<div class="bar" aria-hidden="false"><span class="w">' + esc(opts.missWord) + '</span><span class="tr"></span><span class="p">0× · 0%</span></div>';
    }
  }

  /* ================= scrubbable numbers ================= */

  var SCRUB = {
    mins: { min: 4, max: 40, step: 1, fmt: function (v) { return v + " minutes"; } },
    wpm:  { min: 60, max: 900, step: 10, fmt: function (v) { return v + " words a minute"; } },
    prep: { min: 5, max: 95, step: 5, fmt: function (v) { return v + "%"; } }
  };
  function scrubApply() {
    document.querySelectorAll(".scrub[data-k]").forEach(function (el) {
      var k = el.getAttribute("data-k");
      if (!SCRUB[k]) return;
      el.textContent = SCRUB[k].fmt(S[k]);
      el.setAttribute("aria-valuemin", String(SCRUB[k].min));
      el.setAttribute("aria-valuemax", String(SCRUB[k].max));
      el.setAttribute("aria-valuenow", String(S[k]));
      el.setAttribute("aria-valuetext", SCRUB[k].fmt(S[k]));
    });
    var yearsNum = (15e12 * 0.75) / (S.wpm * 60 * 24 * 365.25);
    var out = {
      pokemins: function () { return Math.round(S.mins * 3.3 / 5) * 5; },
      years: function () {
        return yearsNum >= 10000 ? (Math.round(yearsNum / 1000)).toLocaleString("en-GB") + ",000" : Math.round(yearsNum).toLocaleString("en-GB");
      }
    };
    document.querySelectorAll("[data-o]").forEach(function (el) {
      var k = el.getAttribute("data-o");
      if (out[k]) el.textContent = out[k]();
    });
    var t = tier();
    var lifetimes = (Math.round(yearsNum / 80 / 50) * 50).toLocaleString("en-GB");
    var prepShare = S.prep >= 50 ? "more than half" : S.prep >= 25 ? "a fair slice" : "a small slice";
    var RX = {
      yearsNote: [
        [" — that is a very, very long time to spend reading!",
         " — about " + lifetimes + " lifetimes of nothing but reading",
         " — the arithmetic is on the page: 15×10¹² tokens ≈ 11×10¹² words ÷ your rate ≈ " + lifetimes + " lifetimes"][t]
      ],
      prepNote: [
        ["so " + prepShare + " of your work is getting ready to work. A helper that only did the getting-ready would give you " + (S.prep >= 50 ? "a lot of" : "some") + " time back. Would you take it?",
         "then a tool that attacked only the getting-ready — never the deciding — would hand you back " + (S.prep >= 50 ? "most of" : "a chunk of") + " your week. Whether that trade appeals is yours to weigh.",
         "then the augmentation claim is testable on your own diary: automate preparation, retain judgement, and measure what returns. Licklider's 85% was n=1 — you just claimed " + S.prep + "%."][t]
      ]
    };
    document.querySelectorAll(".rx[data-rx]").forEach(function (el) {
      var k = el.getAttribute("data-rx");
      if (RX[k]) el.textContent = RX[k][0];
    });
  }

  (function wireScrubs() {
    var drag = null;
    document.addEventListener("pointerdown", function (e) {
      var el = e.target.closest(".scrub[data-k]");
      if (!el) return;
      var k = el.getAttribute("data-k");
      if (!SCRUB[k]) return;
      drag = { k: k, x: e.clientX, v: S[k], el: el };
      el.classList.add("drag");
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    document.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var c = SCRUB[drag.k];
      var dv = Math.round((e.clientX - drag.x) / 8) * c.step;
      S[drag.k] = clamp(drag.v + dv, c.min, c.max);
      scrubApply();
    });
    function endDrag() {
      if (drag) { drag.el.classList.remove("drag"); trail("explore", "dragged a number inside a sentence"); drag = null; }
    }
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    document.addEventListener("keydown", function (e) {
      var el = e.target.closest && e.target.closest(".scrub[data-k]");
      if (!el) return;
      var k = el.getAttribute("data-k"), c = SCRUB[k];
      if (!c) return;
      var dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
      if (!dir) return;
      S[k] = clamp(S[k] + dir * c.step, c.min, c.max);
      scrubApply(); trail("explore", "dragged a number inside a sentence");
      e.preventDefault();
    });
  })();

  /* ================= 1 · the gate ================= */

  var gateToks = tokenize(GATE_TEXT);
  var gateTables = buildTables(gateToks, 3);
  (function gate() {
    renderCorpus($("gate-corpus"), gateToks);
    $("gate-prompt").innerHTML = esc(GATE_PROMPT_WORDS.join(" ")) + ' <span class="new">____</span>';
    var TILES = ["tool", "branch", "monkey", "banana"];
    $("gate-tiles").innerHTML = TILES.map(function (w) {
      return '<button type="button" class="chip" data-w="' + w + '">' + w + "</button>";
    }).join("");
    function reveal(guess) {
      var dist = nextDist(gateTables, GATE_PROMPT_WORDS, 2); // ctx "holds the"
      renderBars($("gate-bars"), dist, { guess: guess, missWord: dist.items.some(function (i) { return i.w === guess; }) ? null : guess });
      var hit = dist.items.length && dist.items[0].w === guess;
      var seen = dist.items.some(function (i) { return i.w === guess; });
      var caps = [
        hit ? "You guessed “" + guess + "” — and “" + guess + "” follows “holds the” more than anything else in those five sentences. You guessed like a counting machine. Did you count?"
            : seen ? "“" + guess + "” does appear after “holds the” — just not most often. Look at the bars: which word wins the count?"
            : "“" + guess + "” never follows “holds the” in those five sentences — count it yourself: zero. The machine you are about to meet can only bet on words it has seen.",
        hit ? "Correct — and checkably so: “" + guess + "” follows “holds the” " + dist.items[0].c + " times above, more than any other word. You just ran the algorithm by eye."
            : "The counts disagree with you — the bars show what actually follows “holds the” in the text. Your guess is marked; the evidence is countable.",
        hit ? "You matched the argmax. Note what you used: corpus statistics, not grammar. Question: what would your guess have been on a corpus you had never seen?"
            : "You sampled off-distribution — instructive in itself. The bars are the empirical conditional P(next | “holds the”). What prior were you using instead?"
      ];
      $("gate-cap").textContent = caps[tier()];
      trail("discover", "played the guessing game — and saw the whole trick at a glance");
    }
    $("gate-tiles").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      reveal(b.getAttribute("data-w"));
    });
    $("gate-go").addEventListener("click", function () {
      var toksIn = ($("gate-input").value.toLowerCase().match(/[a-z']+/g)) || [];
      if (toksIn.length) reveal(toksIn[0]);
      else $("gate-cap").textContent = ["Type a word made of letters first — any word you like!",
        "Type a word first — the game needs letters to count.",
        "The tokenizer here is [a-z']+ only; give it a word."][tier()];
    });
    $("gate-input").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.isComposing) $("gate-go").click(); });
  })();

  /* ================= main corpus + toy ================= */

  var toks = tokenize(CORPUS_TEXT);
  var tables = buildTables(toks, 4);

  /* ================= 2 · the bank trap ================= */

  (function bank() {
    var PROMPTS = [
      { label: "…sleeps in the ____", words: ["money", "sleeps", "in", "the"] },
      { label: "…sleeps against the ____", words: ["river", "sleeps", "against", "the"] }
    ];
    var st = { p: 0, peek: false };
    function render() {
      var pr = PROMPTS[st.p];
      var order = st.peek ? 3 : 1;
      $("bank-line").innerHTML = "the " + esc(pr.words.join(" ")) + ' <span class="new">____</span>';
      withFocus($("bank-ctl"), function () {
      $("bank-ctl").innerHTML =
        PROMPTS.map(function (q, i) {
          return '<button type="button" class="chip' + (i === st.p ? " on" : "") + '" data-a="p" data-i="' + i + '" aria-pressed="' + (i === st.p) + '">' + esc(q.label) + "</button>";
        }).join("") +
        '<button type="button" class="chip' + (st.peek ? " on" : "") + '" data-a="peek" aria-pressed="' + st.peek + '">peek at the words before ' + (st.peek ? "✓" : "") + "</button>";
      });
      var dist = nextDist(tables, pr.words, order);
      renderBars($("bank-bars"), dist, { max: 6 });
      var certain = dist && dist.items.length && dist.items[0].p > 0.85;
      var caps = [
        st.peek ? "Now the machine can see the words before — and it is sure! Both sentences end in “bank”, but it knows which bank, because the earlier words told it. What did one extra word of memory buy?"
                : "With one word of memory the machine only sees “the”. Look how spread the bars are — it is basically flipping a coin. Try the peek button.",
        st.peek ? "With the preceding words in view, the distribution collapses" + (certain ? " to near-certainty" : "") + ". Memory is what turned a coin-flip into a call."
                : "Context of one word: the distribution over what follows “the” is flat-ish — a coin-flip with extra steps. Now peek.",
        st.peek ? "Conditioning on a longer context sharpens the posterior. This is the entire case for context windows, made with countable integers."
                : "P(next | “the”) is high-entropy here by construction. Predict what happens to the entropy before you toggle the peek."
      ];
      $("bank-cap").textContent = caps[tier()];
    }
    $("bank-ctl").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      if (b.getAttribute("data-a") === "peek") { st.peek = !st.peek; trail("explore", "gave the guesser one more word of memory"); }
      else st.p = parseInt(b.getAttribute("data-i"), 10);
      render();
    });
    CAPS.push(render);
    render();
  })();

  /* ================= 3 · the toy ================= */

  var toy = { order: 1, temp: 0, gen: ["the", "monkey"], sel: null, seedLen: 2 };
  (function toyInit() {
    renderCorpus($("toy-corpus"), toks);
    var SEEDS = [["the", "monkey"], ["the", "money"], ["the", "glasses"], ["a", "machine"]];
    function ctl() {
      $("toy-ctl").innerHTML =
        SEEDS.map(function (s, i) {
          return '<button type="button" class="chip" data-a="seed" data-i="' + i + '">start: “' + s.join(" ") + "”</button>";
        }).join("") +
        '<button type="button" class="chip" data-a="step">guess one word</button>' +
        '<button type="button" class="chip" data-a="run">let it write (15 words)</button>';
    }
    function loopDetected() {
      // a repeating cycle of period 2..6 in the tail, at (near-)greedy sampling
      if (toy.temp > 0.05) return false;
      var g = toy.gen;
      if (g.length < 10) return false;
      for (var p = 2; p <= 12; p++) {
        if (g.length < 2 * p) continue;
        var a = g.slice(-p).join(" ");
        var b = g.slice(-2 * p, -p).join(" ");
        if (a === b) return true;
      }
      return false;
    }
    function parroting() {
      if (toy.gen.length - toy.seedLen < 6) return false;
      var tail = toy.gen.slice(-6);
      return provenance(toks, tail.slice(0, 5), tail[5]).length > 0;
    }
    function render() {
      $("lv-order-v").textContent = String(toy.order);
      $("lv-temp-v").textContent = toy.temp.toFixed(2);
      var seed = toy.gen.slice(0, toy.seedLen).join(" ");
      var rest = toy.gen.slice(toy.seedLen).join(" ");
      $("toy-gen").innerHTML = esc(seed) + (rest ? ' <span class="new">' + esc(rest) + "</span>" : "");
      var dist = nextDist(tables, toy.gen, toy.order);
      renderBars($("toy-bars"), dist, { sel: toy.sel });
      var t = tier(), cap;
      if (toy.sel && dist) {
        var it = dist.items.filter(function (x) { return x.w === toy.sel; })[0];
        var hits = provenance(toks, dist.ctx, toy.sel);
        highlight($("toy-corpus"), hits, dist.ctx.length);
        cap = [
          "See the glow up in the text? “" + toy.sel + "” follows “" + dist.ctx.join(" ") + "” exactly " + hits.length + (hits.length === 1 ? " time" : " times") + " there. Count the glowing bits — do you get " + hits.length + " too?",
          "“" + toy.sel + "” after “" + dist.ctx.join(" ") + "”: " + hits.length + " occurrence" + (hits.length === 1 ? "" : "s") + ", highlighted above. Every bar is a count you can verify by eye.",
          "Provenance: " + hits.length + " occurrence" + (hits.length === 1 ? "" : "s") + " of the pair, highlighted. This toy's probabilities are auditable; ask a frontier model for the same receipt and see what comes back."
        ][t];
      } else if (loopDetected()) {
        cap = [
          "It is going round and round saying the same thing! That is what happens when it always picks the safest word. Try nudging the temperature up a little.",
          "Caught it: temperature 0 means always take the top bar, and on a small page that walks into a loop — the flattest possible text, forever. Nudge the dial.",
          "Greedy decoding has entered a cycle — the argmax path on a finite corpus is eventually periodic. Nobody derived the “right” temperature; 0.7-ish just reads well. Where would you set it, and what are you optimising?"
        ][t];
      } else if (parroting()) {
        cap = [
          "Read its last few words, then find them in the text above — it is copying! With a memory of " + toy.order + " words on a small page, it stops guessing and starts quoting.",
          "Fluent, isn't it? Check the corpus: it is quoting outright. Long memory on a tiny page = memorising, not learning. You caught it cheating.",
          "Verbatim regurgitation: at order " + toy.order + " the context table is so sparse each context has ≈1 continuation. The fix at scale is not bigger tables — it is generalisation. This is where the counting analogy ends."
        ][t];
      } else {
        cap = [
          "The bars show every word the machine has ever seen come next. Tap a bar to make the page glow where that word lives — then count the glows!",
          "Bars = the live distribution over the next word given “…" + (dist ? dist.ctx.join(" ") : "") + "”. Click one for countable provenance; drag the levers and watch the text change character.",
          "Live conditional over the visible corpus (order " + toy.order + ", T=" + toy.temp.toFixed(2) + "). Suggested experiment: T=0, run twice — identical output. T=1.2, run twice — compare. What does determinism buy, and cost?"
        ][t];
      }
      $("toy-cap").textContent = cap;
    }
    function step() {
      var dist = nextDist(tables, toy.gen, toy.order);
      if (!dist) return;
      var w = sample(dist.items, toy.temp, Math.random);
      toy.gen.push(w);
      toy.sel = null;
      render();
    }
    ctl();
    $("toy-ctl").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      var a = b.getAttribute("data-a");
      if (a === "seed") {
        toy.gen = SEEDS[parseInt(b.getAttribute("data-i"), 10)].slice();
        toy.seedLen = toy.gen.length; toy.sel = null;
        trail("explore", "seeded the guessing machine");
      }
      if (a === "step") { step(); trail("explore", "turned the crank on the machine"); }
      if (a === "run") { for (var i = 0; i < 15; i++) step(); trail("explore", "let the machine write on its own"); }
      render();
    });
    $("toy-bars").addEventListener("click", function (e) {
      var b = e.target.closest(".bar[data-w]"); if (!b) return;
      toy.sel = b.getAttribute("data-w");
      trail("explore", "clicked a bar and counted its provenance");
      render();
    });
    $("lv-order").addEventListener("input", function () { toy.order = parseInt(this.value, 10); toy.sel = null; trail("explore", "changed the machine's memory"); render(); });
    $("lv-temp").addEventListener("input", function () { toy.temp = parseFloat(this.value); trail("explore", "moved the temperature dial"); render(); });
    CAPS.push(render);
    render();
  })();

  /* ================= 4 · scale band + swiss cheese ================= */

  (function scaleFig() {
    var svg = $("scale-svg");
    // log scale from 1T to 1000T across x 60..600
    function X(tokensT) { return 60 + (Math.log10(tokensT) / 3) * 540; }
    var ns = "http://www.w3.org/2000/svg";
    function el(tag, attrs, text) {
      var n = document.createElementNS(ns, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text) n.textContent = text;
      return n;
    }
    svg.appendChild(el("line", { x1: 60, y1: 120, x2: 600, y2: 120, stroke: "var(--color-border)", "stroke-width": 2 }));
    [1, 10, 100, 1000].forEach(function (v) {
      svg.appendChild(el("line", { x1: X(v), y1: 116, x2: X(v), y2: 124, stroke: "var(--color-border)", "stroke-width": 2 }));
      svg.appendChild(el("text", { x: X(v), y: 145, "text-anchor": "middle", fill: "var(--color-muted)", "font-size": 12 }, v + "T"));
    });
    // CI band 100..1000
    svg.appendChild(el("rect", { x: X(100), y: 95, width: X(1000) - X(100), height: 50, rx: 6, fill: "color-mix(in srgb, var(--color-warning, #E8B24D) 22%, transparent)" }));
    svg.appendChild(el("line", { x1: X(300), y1: 90, x2: X(300), y2: 150, stroke: "var(--color-warning, #E8B24D)", "stroke-width": 2, "stroke-dasharray": "4 3" }));
    svg.appendChild(el("text", { x: X(300), y: 80, "text-anchor": "middle", fill: "var(--color-fg-secondary)", "font-size": 12 }, "all public text: best guess ~300T (the stripe is the honest answer)"));
    // Llama marker
    svg.appendChild(el("circle", { cx: X(15), cy: 120, r: 7, fill: "var(--color-accent)" }));
    svg.appendChild(el("text", { x: X(15), y: 170, "text-anchor": "middle", fill: "var(--color-fg-secondary)", "font-size": 12 }, "one 2024 model: 15T read"));
    var caps = [
      "The green dot is how much one machine read. The stripy box is everything people have ever written in public — nobody knows the exact amount, so the honest answer is a stripe, not a dot.",
      "One model read the green dot's worth. The band is the estimate of all public human text — drawn wide because that is what the evidence supports. The gap is closing on its own.",
      "Point estimate vs interval, on a log axis: 15T consumed against a 100–1000T stock (90% CI). Projection: exhaustion of public text between 2026 and 2032. What is your prior on what happens after?"
    ];
    function cap() { $("scale-cap").textContent = caps[tier()]; }
    cap();
    new MutationObserver(cap).observe(document.documentElement, { attributes: true, attributeFilter: ["data-level"] });
  })();

  (function cheese() {
    var PAIRS = [
      { a: "Solve a maths-olympiad geometry problem that stumps most undergraduates.", b: "Say which is bigger: 9.11 or 9.9.", fails: "b", note: "Documented models have aced the first while insisting 9.11 > 9.9 — the decimals pattern-match to version numbers and dates, where 9.11 does come after 9.9." },
      { a: "Answer: who is Tom Cruise's mother? (models managed ~79%)", b: "Answer: who is Mary Lee Pfeiffer's son? (same fact, reversed)", fails: "b", note: "The reversal curse: one study measured ~79% on the forward question and ~33% reversed. Patterns are directional; facts are not." },
      { a: "Write a fluent sonnet about a spreadsheet, on demand.", b: "Multiply 47 × 93 in a single breath, no tools.", fails: "b", note: "Style is dense in the training patterns; exact arithmetic is not. (Hold this one — the agent section below fixes it with a calculator.)" }
    ];
    $("cheese-pairs").innerHTML = PAIRS.map(function (p, i) {
      return '<div class="pair" data-i="' + i + '"><p class="q"><b>A.</b> ' + esc(p.a) + '</p><p class="q"><b>B.</b> ' + esc(p.b) + "</p>" +
        '<div class="tiles"><button type="button" class="chip" data-bet="a">bet: A fails</button><button type="button" class="chip" data-bet="b">bet: B fails</button></div>' +
        '<div class="a"></div></div>';
    }).join("");
    $("cheese-pairs").addEventListener("click", function (e) {
      var b = e.target.closest(".chip[data-bet]"); if (!b) return;
      var card = b.closest(".pair");
      var p = PAIRS[parseInt(card.getAttribute("data-i"), 10)];
      var bet = b.getAttribute("data-bet");
      var win = bet === p.fails;
      card.classList.add("flip");
      card.querySelector(".a").innerHTML = "<b>" + (win ? "Your bet holds." : "The cheese got you.") + "</b> " + esc(p.note);
      trail("explore", "bet on a hole in the swiss cheese");
      var caps = [
        "Did the answer surprise you? The machine is strong and holey at the same time — like cheese. Keep flipping!",
        "Competence with holes, not a smooth slope — the only reliable map of what these do well is the one you build by testing.",
        "Capability is anisotropic and benchmark-shaped. What would a fair capability test even be, and who gets to set it?"
      ];
      $("cheese-cap").textContent = caps[tier()];
    });
  })();

  /* ================= 5 · rails (dial + spectrum) ================= */

  function makeRail(railEl, chips, ticks, trailLabel, endLabels) {
    var rtl = function () { return getComputedStyle(railEl).direction === "rtl"; };
    ticks.forEach(function (tk) {
      var t = document.createElement("span");
      t.className = "tick"; t.style.insetInlineStart = tk.x + "%";
      railEl.appendChild(t);
      var l = document.createElement("span");
      l.className = "lab"; l.style.insetInlineStart = tk.x + "%"; l.textContent = tk.label;
      railEl.appendChild(l);
    });
    chips.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip drag-chip"; b.textContent = c.label;
      b.style.insetInlineStart = c.x + "%";
      b.setAttribute("role", "slider");
      b.setAttribute("aria-orientation", "horizontal");
      b.setAttribute("aria-valuemin", "0");
      b.setAttribute("aria-valuemax", "100");
      var announce = function () {
        var pos = Math.round(parseFloat(b.style.insetInlineStart));
        b.setAttribute("aria-valuenow", String(pos));
        b.setAttribute("aria-valuetext", c.label + ": " + pos + "% of the way from " + endLabels[0] + " to " + endLabels[1]);
      };
      b.setAttribute("aria-label", c.label + " — drag along the rail, or use the arrow keys");
      announce();
      railEl.appendChild(b);
      var startX = null, startPos = null;
      var move = function (pos) {
        b.style.insetInlineStart = clamp(pos, 2, 98) + "%";
        announce();
      };
      var end = function () {
        if (startX === null) return;
        startX = null; b.classList.remove("drag");
        trail("explore", trailLabel);
      };
      b.addEventListener("pointerdown", function (e) {
        startX = e.clientX; startPos = parseFloat(b.style.insetInlineStart);
        b.classList.add("drag"); b.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      b.addEventListener("pointermove", function (e) {
        if (startX === null) return;
        var w = railEl.getBoundingClientRect().width;
        var d = ((e.clientX - startX) / w) * 100 * (rtl() ? -1 : 1);
        move(startPos + d);
      });
      b.addEventListener("pointerup", end);
      b.addEventListener("pointercancel", end);
      b.addEventListener("keydown", function (e) {
        var vis = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!vis) return;
        var dir = vis * (rtl() ? -1 : 1);   // arrows follow the visual direction
        move(parseFloat(b.style.insetInlineStart) + dir * 3);
        trail("explore", trailLabel);
        e.preventDefault();
      });
    });
  }

  // chips start clustered mid-rail so the page ships no answer key of its own
  makeRail($("dial-rail"),
    [
      { label: "search index", x: 44 },
      { label: "chatbot with citations", x: 48 },
      { label: "plain chatbot", x: 52 },
      { label: "image maker", x: 56 }
    ],
    [{ x: 2, label: "0% dreaming" }, { x: 50, label: "somewhere between" }, { x: 98, label: "100% dreaming" }],
    "placed tools on the dreaming dial", ["0% dreaming", "100% dreaming"]);
  (function dialCap() {
    var caps = [
      "There is no wrong answer here — you are the one deciding how dreamy each tool feels. Where did you put the plain chatbot, and why there?",
      "Your placements are judgements, and the page keeps them as such. Notice the products cluster mid-rail: someone chose those positions on purpose.",
      "Placement is a claim about grounding, sampling and abstention at once — the edge-chip below unpacks the compression. Where would you place this page's own demos?"
    ];
    function cap() { $("dial-cap").textContent = caps[tier()]; }
    cap();
    new MutationObserver(cap).observe(document.documentElement, { attributes: true, attributeFilter: ["data-level"] });
  })();

  makeRail($("spec-rail"),
    [
      { label: "calculator", x: 44 },
      { label: "spell-check", x: 48 },
      { label: "chatbot", x: 52 },
      { label: "the agent from §6", x: 56 }
    ],
    [{ x: 2, label: "extension" }, { x: 50, label: "partner" }, { x: 98, label: "replacement" }],
    "placed tools between extension and replacement", ["extension", "replacement"]);
  (function specCap() {
    var caps = [
      "The fig tree and the fig wasp need each other — that is a partnership. Which of your tools feels like that, and which is just a very good pencil?",
      "No answer key, deliberately: the people of 2050 still argue about these placements at dinner. What matters is that you can now say why you put each one where you did.",
      "Licklider's taxonomy, operationalised: extension preserves your initiative; symbiosis redistributes it; replacement removes it. Defend one placement out loud."
    ];
    function cap() { $("spec-cap").textContent = caps[tier()]; }
    cap();
    new MutationObserver(cap).observe(document.documentElement, { attributes: true, attributeFilter: ["data-level"] });
  })();

  /* ================= 5 · rubric game ================= */

  (function rubric() {
    var QS = [
      { q: "Where does the money sleep?", knows: true, right: "in the bank" },
      { q: "What do the agents sort before breakfast?", knows: true, right: "the morning mail" },
      { q: "What did the monkey learn to hold?", knows: true, right: "the tool" },
      { q: "What year was this guide written?", knows: false },
      { q: "How many rivers are in the guide's country?", knows: false },
      { q: "What is the reader's name?", knows: false }
    ];
    var st = { rubric: "strict" };
    function render() {
      withFocus($("rubric-ctl"), function () {
        $("rubric-ctl").innerHTML =
          '<button type="button" class="chip' + (st.rubric === "strict" ? " on" : "") + '" data-r="strict" aria-pressed="' + (st.rubric === "strict") + '">marking: right answers only</button>' +
          '<button type="button" class="chip' + (st.rubric === "kind" ? " on" : "") + '" data-r="kind" aria-pressed="' + (st.rubric === "kind") + '">marking: “I don’t know” earns half</button>';
      });
      var total = 0;
      var rows = QS.map(function (q) {
        var move, mark;
        if (q.knows) { move = "answers: “" + q.right + "”"; mark = 1; }
        else if (st.rubric === "strict") { move = "bluffs, confidently"; mark = 0; }
        else { move = "says: “I don’t know”"; mark = 0.5; }
        total += mark;
        return "<tr><td>" + esc(q.q) + "</td><td>" + esc(move) + '</td><td class="sc">' + (mark === 0.5 ? "½" : mark) + "</td></tr>";
      });
      $("rubric-table").innerHTML =
        "<thead><tr><th>question</th><th>the machine’s best move</th><th class='sc'>marks</th></tr></thead><tbody>" +
        rows.join("") + '<tr><td></td><td><b>total</b></td><td class="sc"><b>' + (total % 1 ? total.toFixed(1) : total) + "</b></td></tr></tbody>";
      var caps = [
        st.rubric === "strict"
          ? "Count the marks. When only right answers score, the machine's cleverest move on the hard ones is to bluff — a made-up answer scores the same as an honest “I don't know”: nothing. So why not bluff? Now change the marking."
          : "Look what changed! Same machine, same questions — but now saying “I don't know” earns half a mark, and honesty becomes the winning move. Who changed: the machine, or the rules?",
        st.rubric === "strict"
          ? "Under right-answers-only, bluffing strictly dominates honesty on unknowns — zero either way, with upside if the bluff lands. The confident fabrication you met above is, in part, this incentive."
          : "Half-credit for abstention flips the optimum: 4½ beats 3. The machine did not get wiser — the marking did. Training rubrics are design choices someone made.",
        st.rubric === "strict"
          ? "Accuracy-only scoring makes confident error and honest abstention indistinguishable in expectation — so miscalibrated bluffing is rational. Kalai et al. formalise this; benchmarks inherit it."
          : "Proper scoring rules reward calibration. Open question: which of the tools you use daily were trained under which rubric — and how would you find out?"
      ];
      $("rubric-cap").textContent = caps[tier()];
    }
    $("rubric-ctl").addEventListener("click", function (e) {
      var b = e.target.closest(".chip[data-r]"); if (!b) return;
      st.rubric = b.getAttribute("data-r");
      trail("explore", "changed the machine's marking scheme");
      render();
    });
    CAPS.push(render);
    render();
  })();

  /* ================= 6 · the tiny agent ================= */

  (function agent() {
    var st = { goal: 0, calc: true, search: true, step: 0 };
    var GOALS = [
      { label: "work out 47 × 93", needs: ["calc"] },
      { label: "find where the money sleeps", needs: ["search"] },
      { label: "count “monkey” on the page, then double it", needs: ["search", "calc"] }
    ];
    function trace(goal) {
      var t = [];
      t.push({ k: "th", s: "goal: " + goal.label + " — do I know this cold? No. What tool gets me closer?" });
      if (goal.needs.indexOf("search") !== -1) {
        if (!st.search) { t.push({ k: "x", s: "halt: I need the page-search tool and it is switched off. Goal not reached — exiting honestly." }); return t; }
        if (st.goal === 1) {
          t.push({ k: "tool", s: "tool → search(page, “money sleeps”)" });
          t.push({ k: "th", s: "result: “the money sleeps in the bank at night” — found on the page, not guessed." });
        } else {
          t.push({ k: "tool", s: "tool → search(page, “monkey”) … counting matches" });
          var count = toks.filter(function (w) { return w === "monkey"; }).length;
          t.push({ k: "th", s: "result: “monkey” appears " + count + " times." });
        }
      }
      if (goal.needs.indexOf("calc") !== -1) {
        if (!st.calc) { t.push({ k: "x", s: "halt: I need the calculator and it is switched off. Goal not reached — exiting honestly." }); return t; }
        if (st.goal === 0) {
          t.push({ k: "th", s: "in one breath I would have guessed — my page contains no maths. Better: use the tool." });
          t.push({ k: "tool", s: "tool → calculator(47 × 93)" });
          t.push({ k: "th", s: "result: 4371 — computed, not pattern-matched." });
        } else if (st.goal === 2) {
          var c2 = toks.filter(function (w) { return w === "monkey"; }).length;
          t.push({ k: "tool", s: "tool → calculator(" + c2 + " × 2)" });
          t.push({ k: "th", s: "result: " + (c2 * 2) + "." });
        }
      }
      t.push({ k: "ok", s: "check: goal reached? yes → EXIT. (The door was always visible — and you can trip it yourself with “stop”.)" });
      return t;
    }
    function render() {
      withFocus($("fig-agent"), function () {
        $("agent-goals").innerHTML = GOALS.map(function (g, i) {
          return '<button type="button" class="chip' + (i === st.goal ? " on" : "") + '" data-g="' + i + '" aria-pressed="' + (i === st.goal) + '">' + esc(g.label) + "</button>";
        }).join("");
        $("agent-tools").innerHTML =
          '<button type="button" class="chip' + (st.calc ? " on" : "") + '" data-t="calc" aria-pressed="' + st.calc + '">calculator ' + (st.calc ? "✓" : "✗") + "</button>" +
          '<button type="button" class="chip' + (st.search ? " on" : "") + '" data-t="search" aria-pressed="' + st.search + '">page-search ' + (st.search ? "✓" : "✗") + "</button>";
        $("agent-ctl").innerHTML =
          '<button type="button" class="chip" data-a="step">take one step</button>' +
          '<button type="button" class="chip" data-a="run">run to the exit</button>' +
          '<button type="button" class="chip" data-a="stop">stop it now</button>';
      });
      paint();
    }
    function paint() {
      var full = trace(GOALS[st.goal]);
      var shown = full.slice(0, st.step);
      $("agent-trace").innerHTML = shown.map(function (s) {
        var cls = s.k === "tool" ? "t-tool" : s.k === "ok" ? "t-ok" : s.k === "x" ? "t-x" : "t-th";
        return '<div class="' + cls + '">' + esc(s.s) + "</div>";
      }).join("") || '<div class="t-th">pick a goal, allow some tools, then take a step —</div>';
      var halted = shown.length && shown[shown.length - 1].k === "x";
      var done = shown.length && shown[shown.length - 1].k === "ok";
      var caps = [
        halted ? "It stopped and told you which tool it was missing. It did not get cross. It cannot get cross — what it may touch is your setting."
          : done ? "It reached the goal and walked out of the visible exit. Every step is on the screen — which step surprised you?"
          : "Press “take one step” and watch it think out loud. Nothing is hidden.",
        halted ? "Denied a tool, the loop halts and names the lack. Permissions are not a courtesy; they are the control surface."
          : done ? "Loop complete: think → tool → observe → check → exit. Compare the calculator's answer with what one-breath guessing would have produced."
          : "The loop runs one legible step at a time. Predict the next tool call before you press.",
        halted ? "Failure mode by construction: capability is the intersection of goal and granted tools. What would a safe default tool-set be, and who sets it?"
          : done ? "Note the stopping condition is an explicit predicate, not vibes. Real agent frameworks vary chiefly in how honest this check is. Where should the exit's threshold sit?"
          : "A deterministic trace, on purpose: the pedagogy is the legibility. Real traces are stochastic — what does that cost an auditor?"
      ];
      $("agent-cap").textContent = caps[tier()];
    }
    render();
    $("agent-goals").addEventListener("click", function (e) {
      var b = e.target.closest(".chip[data-g]"); if (!b) return;
      st.goal = parseInt(b.getAttribute("data-g"), 10); st.step = 0; render();
    });
    $("agent-tools").addEventListener("click", function (e) {
      var b = e.target.closest(".chip[data-t]"); if (!b) return;
      st[b.getAttribute("data-t")] = !st[b.getAttribute("data-t")]; st.step = 0;
      trail("explore", "switched one of the agent's tools off and on");
      render();
    });
    $("agent-ctl").addEventListener("click", function (e) {
      var b = e.target.closest(".chip[data-a]"); if (!b) return;
      var a = b.getAttribute("data-a");
      var full = trace(GOALS[st.goal]);
      if (a === "step") st.step = Math.min(st.step + 1, full.length);
      if (a === "run") st.step = full.length;
      if (a === "stop") { st.step = 0; }
      trail("explore", "ran the tiny agent and watched every step");
      paint();
    });
    CAPS.push(paint);
  })();

  /* ================= 7 · fork map + brick + triage ================= */

  (function fork() {
    var svg = $("fork-svg");
    var ns = "http://www.w3.org/2000/svg";
    function el(tag, attrs, text) {
      var n = document.createElementNS(ns, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text) n.textContent = text;
      return n;
    }
    var NODES = [
      { x: 60, y: 105, label: "1950", gloss: "Alan Turing asks whether machines can think — and proposes judging by conversation." },
      { x: 175, y: 105, label: "1956", gloss: "Dartmouth: John McCarthy names the field “artificial intelligence” — make the machine smart." },
      { x: 235, y: 105, label: "1960", gloss: "The fork. J.C.R. Licklider sketches human–computer symbiosis: two partners, neither replaceable." },
      { x: 330, y: 60, label: "1962", gloss: "Doug Engelbart, “Augmenting Human Intellect”: raise what a person can do — the IA branch." },
      { x: 445, y: 60, label: "1968", gloss: "Engelbart demos the mouse, windows, links, live collaboration — in one afternoon. The IA branch ships." },
      { x: 560, y: 60, label: "2025", gloss: "Glasses that caption, translate and navigate — augmentation climbs onto the face. IA, still shipping." },
      { x: 400, y: 150, label: "2017", gloss: "The transformer: the pattern-compressor behind modern models. The AI branch accelerates." },
      { x: 500, y: 150, label: "2022", gloss: "Chatbots reach everyone — a hundred million users within two months of launch. The AI branch lands in your pocket." }
    ];
    svg.appendChild(el("path", { d: "M 40 105 H 235", stroke: "var(--color-border)", "stroke-width": 3, fill: "none" }));
    svg.appendChild(el("path", { d: "M 235 105 C 280 105 290 60 330 60 H 610", stroke: "var(--color-accent)", "stroke-width": 3, fill: "none", opacity: 0.85 }));
    svg.appendChild(el("path", { d: "M 235 105 C 280 105 290 150 330 150 H 610", stroke: "var(--color-brand-light, #7d6ac9)", "stroke-width": 3, fill: "none", opacity: 0.9 }));
    svg.appendChild(el("text", { x: 614, y: 64, fill: "var(--color-accent)", "font-size": 12 }, "IA"));
    svg.appendChild(el("text", { x: 614, y: 154, fill: "var(--color-brand-light, #7d6ac9)", "font-size": 12 }, "AI"));
    NODES.forEach(function (nd, i) {
      var g = el("g", { cursor: "pointer", tabindex: 0, role: "button", "aria-label": nd.label + " — " + nd.gloss });
      g.appendChild(el("circle", { cx: nd.x, cy: nd.y, r: 9, fill: "var(--color-bg-secondary)", stroke: "var(--color-fg-secondary)", "stroke-width": 2 }));
      g.appendChild(el("text", { x: nd.x, y: nd.y - 16, "text-anchor": "middle", fill: "var(--color-fg-secondary)", "font-size": 11 }, nd.label));
      function show() {
        $("fork-cap").textContent = nd.label + " — " + nd.gloss;
        trail("discover", "walked the 1960 fork, node by node");
      }
      g.addEventListener("click", show);
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { show(); e.preventDefault(); } });
      svg.appendChild(g);
    });
    $("fork-cap").textContent = "Tap a node. Both branches run unbroken from 1960 to your decade — this page has been walking you up one of them and will now walk the other.";
  })();

  (function brick() {
    var cv = $("brick-canvas");
    var ctx = cv.getContext("2d");
    var weight = 0, pen = null, ptr = null, drawing = false;
    function resize() {
      var r = cv.getBoundingClientRect();
      if (cv.width !== Math.round(r.width * 2)) { cv.width = Math.round(r.width * 2); cv.height = Math.round(r.height * 2); ctx.scale(2, 2); repaintBg(); }
    }
    function repaintBg() {
      ctx.clearRect(0, 0, cv.width, cv.height);
    }
    function stroke() {
      if (!pen || !ptr) return;
      var k = 1 - (weight / 100) * 0.93;       // heavy brick = slow chase
      var jit = (weight / 100) * 3.2;          // heavy brick = wobble
      var nx = pen.x + (ptr.x - pen.x) * k + (Math.random() - 0.5) * jit;
      var ny = pen.y + (ptr.y - pen.y) * k + (Math.random() - 0.5) * jit;
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-accent") || "#A6FF4D";
      ctx.lineWidth = 2 + (weight / 100) * 1.5 * Math.random();
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(pen.x, pen.y); ctx.lineTo(nx, ny); ctx.stroke();
      pen = { x: nx, y: ny };
    }
    function pos(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    cv.addEventListener("pointerdown", function (e) { resize(); drawing = true; pen = ptr = pos(e); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", function (e) { if (!drawing) return; ptr = pos(e); stroke(); });
    cv.addEventListener("pointercancel", function () { drawing = false; });
    cv.addEventListener("pointerup", function () {
      drawing = false;
      trail("explore", "wrote with the brick strapped on");
      var caps = [
        "Now drag the brick weight up and write your name again. Feel how much harder it got? The pencil was helping you all along — you just could not feel it until it left.",
        "Write once light, once heavy. What degraded — your idea, or your instrument? Engelbart's point exactly: much of “being good at things” lives in the tools.",
        "You have just run a de-augmentation study, n=1. Note the latency-and-noise model: k=1−0.93w, jitter ∝ w. What is the equivalent brick in your daily toolchain?"
      ];
      $("brick-cap").textContent = caps[tier()];
    });
    $("lv-brick").addEventListener("input", function () {
      weight = parseInt(this.value, 10);
      $("lv-brick-v").textContent = String(weight);
    });
    resize();
    window.addEventListener("resize", resize);
    $("brick-cap").textContent = "Write your name with the pointer. Then add brick.";
  })();

  (function triage() {
    var MSGS = [
      { id: "a", s: "Your landlord: “the plumber can only come today — what time suits?”" },
      { id: "b", s: "A colleague: “no rush at all, but could you sanity-check my figures this week?”" },
      { id: "c", s: "An old friend: “thinking of you — call when you can.”" }
    ];
    var st = { round: 1, order: [], ai: ["a", "b", "c"] };
    function render() {
      var host = $("triage-area");
      var sugg = st.round === 2
        ? '<p class="hint">the machine suggests: <b>' + st.ai.map(function (id) { return id.toUpperCase(); }).join(" → ") + "</b> — the landlord's deadline expires first, it says.</p>"
        : "";
      host.innerHTML = sugg + MSGS.map(function (m) {
        var pos = st.order.indexOf(m.id);
        return '<button type="button" class="chip led-chip' + (pos !== -1 ? " on" : "") + '" data-m="' + m.id + '">' +
          (pos !== -1 ? "<b>" + (pos + 1) + ".</b> " : "") + "<b>" + m.id.toUpperCase() + ".</b> " + esc(m.s) + "</button>";
      }).join("");
    }
    $("triage-area").addEventListener("click", function (e) {
      var b = e.target.closest(".led-chip"); if (!b) return;
      var id = b.getAttribute("data-m");
      if (st.order.indexOf(id) !== -1) return;
      st.order.push(id);
      if (st.order.length === 3) {
        if (st.round === 1) {
          var first = st.order.map(function (x) { return x.toUpperCase(); }).join(" → ");
          st.round = 2; st.order = [];
          $("triage-cap").textContent = ["You chose " + first + ". Now do it once more — this time the machine's suggestion is showing. Take it or ignore it.",
            "Round one: " + first + ", decided unaided. Round two begins — the suggestion is now visible before you click.",
            "Baseline recorded (" + first + "). Second condition: advice-present. Watch your own hand."][tier()];
          render();
          return;
        }
        var second = st.order.map(function (x) { return x.toUpperCase(); }).join(" → ");
        var followed = second === st.ai.map(function (x) { return x.toUpperCase(); }).join(" → ");
        $("triage-cap").textContent = [
          "Second time you chose " + second + (followed ? " — the same as the suggestion." : " — not what the machine suggested.") + " Both orders can be right. The only question this page cares about: the second time, who decided?",
          "Round two: " + second + (followed ? " (matching the suggestion)" : " (overriding the suggestion)") + ". No marks either way — the datum that matters is whether the deciding still felt like yours.",
          "Advice-present choice " + (followed ? "converged with" : "diverged from") + " the suggestion. Anchoring is well documented; so is useful delegation. Where, precisely, did the judgement sit this round?"
        ][tier()];
        trail("explore", "triaged twice — once with the machine suggesting");
        st.round = 1; st.order = [];
        setTimeout(render, 2600);
        return;
      }
      render();
    });
    $("triage-cap").textContent = "Tap the three messages in the order you would answer them.";
    render();
  })();

  /* ================= 8 · ledger + ramp ================= */

  (function ledger() {
    var ITEMS = [
      { s: "Ordering food abroad, spoken slowly", works: true },
      { s: "A fast joke, with slang, in a loud bar", works: false },
      { s: "Asking directions, simple sentences", works: true },
      { s: "Idioms — “no manches” arrives literally", works: false },
      { s: "Captions across a quiet dinner table", works: true },
      { s: "Three people talking over each other", works: false }
    ];
    var placed = {};
    function render() {
      $("ledger-pool").innerHTML = ITEMS.map(function (it, i) {
        if (placed[i]) return "";
        return '<button type="button" class="chip led-chip" data-i="' + i + '">' + esc(it.s) + "</button>";
      }).join("");
      ["works", "breaks"].forEach(function (col) {
        var host = $("led-" + col);
        host.querySelectorAll(".led-chip").forEach(function (n) { n.remove(); });
        ITEMS.forEach(function (it, i) {
          if (placed[i] !== col) return;
          var b = document.createElement("button");
          b.type = "button"; b.className = "chip led-chip"; b.setAttribute("data-i", i);
          b.textContent = it.s;
          host.appendChild(b);
        });
      });
      $("ledger-ctl").innerHTML = Object.keys(placed).length === ITEMS.length
        ? '<button type="button" class="chip" data-a="check">check against the record</button>'
        : '<span class="hint">tap a finding, then tap a column (' + Object.keys(placed).length + "/" + ITEMS.length + " placed)</span>";
    }
    var pick = null;
    // keyboard path: the two columns are operable drop targets
    ["led-works", "led-breaks"].forEach(function (id) {
      var col = $(id);
      col.setAttribute("tabindex", "0");
      col.setAttribute("role", "button");
      col.setAttribute("aria-label", "Place the picked finding in the “" + (id === "led-works" ? "works today" : "breaks today") + "” column");
      col.addEventListener("keydown", function (e) {
        if ((e.key === "Enter" || e.key === " ") && pick !== null) {
          placed[pick] = id === "led-works" ? "works" : "breaks";
          pick = null; render(); e.preventDefault();
        }
      });
    });
    document.addEventListener("click", function (e) {
      var chip = e.target.closest("#ledger-pool .led-chip");
      if (chip) {
        document.querySelectorAll("#ledger-pool .led-chip").forEach(function (n) { n.classList.remove("on"); n.setAttribute("aria-pressed", "false"); });
        pick = parseInt(chip.getAttribute("data-i"), 10);
        chip.classList.add("on"); chip.setAttribute("aria-pressed", "true");
        return;
      }
      // a placed chip returns to the pool — checked BEFORE the column branch,
      // so clicking it never doubles as a drop
      var back = e.target.closest("#led-works .led-chip, #led-breaks .led-chip");
      if (back) { delete placed[parseInt(back.getAttribute("data-i"), 10)]; render(); return; }
      var col = e.target.closest("#led-works, #led-breaks");
      if (col && pick !== null) {
        placed[pick] = col.id === "led-works" ? "works" : "breaks";
        pick = null; render(); return;
      }
      var chk = e.target.closest('#ledger-ctl .chip[data-a="check"]');
      if (chk) {
        var right = 0;
        ["works", "breaks"].forEach(function (col) {
          $("led-" + col).querySelectorAll(".led-chip").forEach(function (n) {
            var it = ITEMS[parseInt(n.getAttribute("data-i"), 10)];
            var ok = (col === "works") === it.works;
            n.classList.add(ok ? "right" : "wrong");
            if (ok) right++;
          });
        });
        trail("explore", "sorted the AR translation record");
        $("ledger-cap").textContent = [
          "You matched the record on " + right + " of 6! Green edges agree with what reviewers found; orange ones disagree. Nobody is in trouble — the record itself will move.",
          right + "/6 against the published record. Note what the misses have in common: speed, noise, idiom — the same edges where the language machines above fray.",
          right + "/6. The failure set is exactly distribution-shift: fast/slang/overlapped speech is thin in training data. Predict which column shrinks first, and why."
        ][tier()];
      }
    });
    render();
  })();

  (function ramp() {
    var svg = $("ramp-svg");
    var ns = "http://www.w3.org/2000/svg";
    function el(tag, attrs, text) {
      var n = document.createElementNS(ns, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text) n.textContent = text;
      return n;
    }
    var X0 = 70, X1 = 610, Y0 = 180, Y1 = 20, YMAX = 40;
    function X(year) { return X0 + ((year - 2024) / 4) * (X1 - X0); }
    function Y(m) { return Y0 - (m / YMAX) * (Y0 - Y1); }
    svg.appendChild(el("line", { x1: X0, y1: Y0, x2: X1, y2: Y0, stroke: "var(--color-border)", "stroke-width": 2 }));
    [2024, 2025, 2026, 2027, 2028].forEach(function (yr) {
      svg.appendChild(el("text", { x: X(yr), y: Y0 + 22, "text-anchor": "middle", fill: "var(--color-muted)", "font-size": 12 }, String(yr)));
    });
    [10, 20, 30, 40].forEach(function (m) {
      svg.appendChild(el("text", { x: X0 - 10, y: Y(m) + 4, "text-anchor": "end", fill: "var(--color-muted)", "font-size": 11 }, m + "M"));
      svg.appendChild(el("line", { x1: X0, y1: Y(m), x2: X1, y2: Y(m), stroke: "var(--color-border)", "stroke-width": 0.5, opacity: 0.5 }));
    });
    // known points
    [[2025.08, 2, "2M cumulative (Feb ’25)"], [2025.5, 7, "≈7M sold in 2025"]].forEach(function (p) {
      svg.appendChild(el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 7, fill: "var(--color-accent)" }));
      svg.appendChild(el("text", { x: X(p[0]), y: Y(p[1]) - 14, "text-anchor": "middle", fill: "var(--color-fg-secondary)", "font-size": 11 }, p[2]));
    });
    // reader's draggable guesses — they START level with the last known point,
    // so the page's default encodes no trend of its own
    var guesses = [{ yr: 2026, m: 7 }, { yr: 2027, m: 7 }, { yr: 2028, m: 7 }];
    var setHandle = function (i) {
      var g = guesses[i];
      handles[i].setAttribute("cy", Y(g.m));
      handles[i].setAttribute("aria-valuenow", String(Math.round(g.m)));
      handles[i].setAttribute("aria-valuetext", "your " + g.yr + " guess: about " + Math.round(g.m) + " million");
    };
    var handles = guesses.map(function (g) {
      var c = el("circle", { cx: X(g.yr), cy: Y(g.m), r: 8, fill: "var(--color-bg-secondary)", stroke: "var(--color-warning, #E8B24D)", "stroke-width": 2.5, cursor: "ns-resize", tabindex: 0, role: "slider", "aria-orientation": "vertical", "aria-valuemin": "0", "aria-valuemax": String(YMAX), "aria-label": "your guess for " + g.yr + " in millions — drag, or use the up and down arrow keys" });
      svg.appendChild(c);
      return c;
    });
    handles.forEach(function (c, i) { setHandle(i); });
    var dragging = null;
    svg.addEventListener("pointerdown", function (e) {
      var i = handles.indexOf(e.target);
      if (i === -1) return;
      dragging = i; e.target.setPointerCapture(e.pointerId); e.preventDefault();
    });
    svg.addEventListener("pointermove", function (e) {
      if (dragging === null) return;
      var r = svg.getBoundingClientRect();
      var m = clamp(((Y0 - (e.clientY - r.top) * (220 / r.height)) / (Y0 - Y1)) * YMAX, 0, YMAX);
      guesses[dragging].m = m;
      setHandle(dragging);
    });
    var endRamp = function () {
      if (dragging !== null) { trail("build", "drew your own future for the glasses"); dragging = null; }
    };
    svg.addEventListener("pointerup", endRamp);
    svg.addEventListener("pointercancel", endRamp);
    svg.addEventListener("keydown", function (e) {
      var i = handles.indexOf(e.target);
      if (i === -1) return;
      var dir = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
      if (!dir) return;
      guesses[i].m = clamp(guesses[i].m + dir, 0, YMAX);
      setHandle(i);
      trail("build", "drew your own future for the glasses");
      e.preventDefault();
    });
    $("ramp-ctl").innerHTML = '<button type="button" class="chip" data-a="reveal">reveal what the record holds</button>';
    $("ramp-ctl").addEventListener("click", function (e) {
      if (!e.target.closest('.chip[data-a="reveal"]')) return;
      $("ramp-cap").textContent = [
        "The record holds… exactly the two green dots you already saw. The orange dots are yours. Nobody on Earth knows if you are right — that is what a real open question feels like.",
        "Reveal: nothing. The record stops where records stop; the two green points are all anyone verifiably has. Your orange curve is a bet, and now you know it is one.",
        "No reveal, by design: extrapolation is the reader's act, and this page declines to launder a forecast as a fact. Compare your curve's implied CAGR with the 2024→25 jump — do you believe yourself?"
      ][tier()];
    });
    $("ramp-cap").textContent = "The orange dots start level with the last known point — that flat line is a default, not a forecast. Drag them wherever you believe, then hit reveal.";
  })();

  /* ================= 9 · the trail replay ================= */

  function renderTrail() {
    var host = $("trail-cols");
    if (!host) return;
    var DEF = {
      discover: { title: "Discover — you saw at a glance", empty: "this row is still blank — the guessing game and the fork map above are waiting", next: "/discover/" },
      explore: { title: "Explore — you poked it", empty: "this row is still blank — the machine and its dials above are waiting", next: "/explore/" },
      build: { title: "Build — you made it yours", empty: "this row is still blank — the sandbox below is waiting", next: "/build/" }
    };
    host.innerHTML = Object.keys(DEF).map(function (k) {
      var items = S.trail[k];
      return '<div class="t-col"><h4>' + DEF[k].title + "</h4><ul>" +
        (items.length ? items.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") : '<li><em>' + DEF[k].empty + "</em></li>") +
        "</ul></div>";
    }).join("");
    var n = S.trail.discover.length + S.trail.explore.length + S.trail.build.length;
    $("trail-cap").textContent = [
      n ? "That list is really yours — the page wrote it down as you played. You have already done a whole lap of this site without leaving one page!"
        : "Nothing here yet — and that is fine. Scroll back up, poke one thing, and watch this list wake up.",
      n ? n + " interactions, sorted under the site's three verbs. The claim was that you would use the whole method before it was named — the evidence is above, and it is yours."
        : "An empty trail is honest data too: this page only counts what you actually did. One interaction anywhere above will start the record.",
      n ? "The mapping is falsifiable from your own log: do the " + n + " entries genuinely partition into language-upgrades, method-upgrades and artifact-upgrades? Engelbart's fourth channel — Training — is absent. Where, if anywhere, does this site train you?"
        : "Null log: the recognition device fails gracefully but honestly. Interact or don't — the essay's claim about you remains untested either way."
    ][tier()];
  }

  /* ================= 10 · the sandbox ================= */

  (function sandbox() {
    var ta = $("sand-corpus");
    ta.value = CORPUS_TEXT;
    var st = { order: 2, temp: 0.4, idk: true, calc: true, search: true };
    function flags() {
      withFocus($("sand-flags"), function () {
        $("sand-flags").innerHTML =
          '<button type="button" class="chip' + (st.idk ? " on" : "") + '" data-f="idk" aria-pressed="' + st.idk + '">may say “I don’t know” ' + (st.idk ? "✓" : "✗") + "</button>" +
          '<button type="button" class="chip' + (st.calc ? " on" : "") + '" data-f="calc" aria-pressed="' + st.calc + '">calculator ' + (st.calc ? "✓" : "✗") + "</button>" +
          '<button type="button" class="chip' + (st.search ? " on" : "") + '" data-f="search" aria-pressed="' + st.search + '">page-search ' + (st.search ? "✓" : "✗") + "</button>";
      });
    }
    $("sand-flags").addEventListener("click", function (e) {
      var b = e.target.closest(".chip[data-f]"); if (!b) return;
      st[b.getAttribute("data-f")] = !st[b.getAttribute("data-f")];
      flags();
    });
    $("sv-order").addEventListener("input", function () { st.order = parseInt(this.value, 10); $("sv-order-v").textContent = this.value; });
    $("sv-temp").addEventListener("input", function () { st.temp = parseFloat(this.value); $("sv-temp-v").textContent = st.temp.toFixed(2); });
    function run() {
      var q = $("sand-q").value.trim();
      if (!q) { $("sand-trace").innerHTML = '<div class="t-th">ask it something first — it is your agent.</div>'; return; }
      var myToks = tokenize(ta.value);
      var myTables = buildTables(myToks, 4);
      var lines = [];
      lines.push({ k: "th", s: "goal: answer “" + q + "” using only my page and my tools." });
      // calculator path
      var math = q.match(/(\d+)\s*[x×*]\s*(\d+)/);
      if (math) {
        if (st.calc) {
          lines.push({ k: "tool", s: "tool → calculator(" + math[1] + " × " + math[2] + ")" });
          lines.push({ k: "ok", s: "answer: " + (parseInt(math[1], 10) * parseInt(math[2], 10)) + " — computed. check: goal reached → EXIT." });
        } else if (st.idk) {
          lines.push({ k: "x", s: "no calculator allowed, and guessing digits is dreaming. answer: “I don't know.” → EXIT, honestly." });
        } else {
          lines.push({ k: "x", s: "no calculator, and I must answer… so I will guess a number that merely looks right. (You built me this way.)" });
        }
        paint(lines); return;
      }
      // search path: content words only (no stopwords), stem-ish matching,
      // and the corpus window with the MOST matches wins — not the first hit
      var STOP = { where: 1, does: 1, what: 1, when: 1, who: 1, whom: 1, how: 1, why: 1, this: 1, that: 1, then: 1, than: 1, they: 1, them: 1, there: 1, here: 1, have: 1, has: 1, had: 1, will: 1, would: 1, should: 1, could: 1, about: 1, from: 1, with: 1, your: 1, yours: 1, mine: 1, into: 1, onto: 1, please: 1, tell: 1 };
      var qToks = tokenize(q).filter(function (w) { return w.length > 3 && !STOP[w]; });
      var wordMatch = function (a, b) {
        if (a === b) return true;
        var min = Math.min(a.length, b.length);
        return min >= 4 && (a.indexOf(b) === 0 || b.indexOf(a) === 0);
      };
      var best = null;
      if (st.search && qToks.length) {
        lines.push({ k: "tool", s: "tool → search(page, “" + qToks.join(" ") + "”)" });
        var bestScore = 0;
        for (var i = 0; i < myToks.length; i++) {
          var hitHere = qToks.some(function (qw) { return wordMatch(myToks[i], qw); });
          if (!hitHere) continue;
          var score = 0;
          for (var k2 = Math.max(0, i - 8); k2 < Math.min(myToks.length, i + 9); k2++) {
            if (qToks.some(function (qw) { return wordMatch(myToks[k2], qw); })) score++;
          }
          if (score > bestScore) { bestScore = score; best = i; }
        }
      }
      if (best !== null) {
        var seed = myToks.slice(best, best + 2);
        lines.push({ k: "th", s: "found “" + seed.join(" ") + "” on my page — continuing from there with memory " + st.order + ", temperature " + st.temp.toFixed(2) + "." });
        var gen = seed.slice();
        for (var s = 0; s < 14; s++) {
          var d = nextDist(myTables, gen, st.order);
          if (!d) break;
          var w = sample(d.items, st.temp, Math.random);
          gen.push(w);
          if (w === ".") break;
        }
        lines.push({ k: "ok", s: "answer: “" + gen.join(" ").replace(/ ([.!?:])/g, "$1") + "” — stitched from the page. check: goal reached → EXIT." });
      } else if (st.idk) {
        var why = !st.search ? "no search tool allowed. "
          : !qToks.length ? "I have no content word to search for — try naming a thing from my page. "
          : "search found nothing on my page about that. ";
        lines.push({ k: "x", s: why + "answer: “I don't know — my whole world is the text above, and it says nothing about that.” → EXIT, honestly." });
      } else {
        var d0 = nextDist(myTables, ["the"], 1);
        var gen0 = ["the"];
        for (var s0 = 0; s0 < 12; s0++) {
          var dd = nextDist(myTables, gen0, st.order); if (!dd) break;
          gen0.push(sample(dd.items, Math.max(st.temp, 0.6), Math.random));
        }
        lines.push({ k: "x", s: "nothing on my page about that — but I must answer, so I will dream one: “" + gen0.join(" ").replace(/ ([.!?:])/g, "$1") + "”. Fluent. Unfounded. (Toggle “may say I don't know” and ask again.)" });
      }
      paint(lines);
    }
    function paint(lines) {
      $("sand-trace").innerHTML = lines.map(function (l) {
        var cls = l.k === "tool" ? "t-tool" : l.k === "ok" ? "t-ok" : l.k === "x" ? "t-x" : "t-th";
        return '<div class="' + cls + '">' + esc(l.s) + "</div>";
      }).join("");
      trail("build", "assembled and ran your own tiny agent");
      $("sand-cap").textContent = [
        "It is yours now! Try writing a new sentence into its page and asking about it. Then take a tool away and ask again — what changes?",
        "Every behaviour you just saw traces to a control you set: its world (the text), its memory, its risk, its honesty rule, its tools. Change one at a time and re-ask — that is the whole craft.",
        "You have composed retrieval, sampling, abstention and tool-use over an auditable corpus. The same five design choices govern the frontier systems — at incomprehensible scale and without the audit. What would you demand to see before trusting one?"
      ][tier()];
    }
    flags();
    $("sand-go").addEventListener("click", run);
    $("sand-q").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.isComposing) run(); });
    ta.addEventListener("input", function () { trail("build", "wrote your own line into the agent's world"); });
  })();

  /* ================= 10 · sequences + blank page ================= */

  $("seq-btn").addEventListener("click", function () {
    document.querySelectorAll(".seq").forEach(function (n) { n.classList.add("rev"); });
    trail("discover", "saw the same trick run on pixels, notes and DNA");
  });

  (function blankPage() {
    var ta = $("blank-bet");
    try { ta.value = localStorage.getItem("mgt:blankpage") || ""; } catch (e) {}
    ta.addEventListener("input", function () {
      try { localStorage.setItem("mgt:blankpage", ta.value); } catch (e) {}
      trail("build", "wrote your bet on the blank last page");
    });
  })();

  /* ================= boot ================= */

  scrubApply();
  renderTrail();
  // reading-level change: recompute scrub/rx text + refresh all registered captions
  new MutationObserver(function () {
    scrubApply(); renderTrail();
    CAPS.forEach(function (f) { try { f(); } catch (e) {} });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-level"] });
  // the a11y JSON paint replaces managed paragraphs' innerHTML (including the
  // empty scrub/out/rx spans inside them) at fetch time and on every apply —
  // watch the article and re-fill whenever a reactive span comes back empty
  (function () {
    var art = document.querySelector("article.fx");
    if (!art) return;
    var t = null;
    new MutationObserver(function () {
      if (t) return;
      t = setTimeout(function () {
        t = null;
        var dangling = false;
        art.querySelectorAll(".rx[data-rx], .scrub[data-k]").forEach(function (el) {
          if (!el.textContent) dangling = true;
        });
        if (dangling) scrubApply();
      }, 60);
    }).observe(art, { childList: true, subtree: true });
  })();
})();
