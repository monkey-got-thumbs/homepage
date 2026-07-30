/* THE PRIZE MACHINE — the reward experiment from 3:26-5:32 of the RSA Drive animation, playable.
 *
 * Three dials: the prize on offer, the kind of task, and whether the base pay is enough to stop
 * thinking about money. Two readouts: where the person's attention is, and how the work went.
 *
 * The point of the third dial and the attention readout is that the machine gets DEEPER the longer
 * you fiddle. Layer 1: prize up, the two tasks come apart. Layer 2: you can see why — the prize
 * pulls attention off the work. Layer 3: the rules task doesn't need that attention, which is why
 * prizes help there and hurt here. Layer 4: pay enough and the prize loses its grip. Six discoveries
 * only tick off when the reader actually produces the state that demonstrates them.
 *
 * WHAT IS MEASURED AND WHAT IS MODEL — this distinction is load-bearing, do not blur it:
 *   - Measured, and reported ORDINALLY (which group did better, never by how much): with the prize
 *     at three levels, the rules task improves; the thinking task shows no gain at the middle prize
 *     and is worst of all at the top. Bar lengths therefore encode rank and direction only.
 *   - Model, i.e. the stated explanation rather than a tested condition: the attention split, and
 *     the base-pay dial. The talk says to "pay people enough to take the issue of money off the
 *     table... so they're not thinking about money and they're thinking about the work" — but base
 *     pay was not a manipulated variable in the experiment. The figure labels this as the mechanism.
 *
 * CSP-safe (external, same-origin). Classic IIFE — no import/export. Every control is a real radio
 * input, so the whole thing is keyboard operable natively via radiogroup arrow keys. No colour
 * carries meaning alone: length is the encoding, so it survives the colour-vision filters. */
(function () {
  "use strict";

  var fig = document.getElementById("reward-experiment");
  if (!fig) return;

  var PRIZE = ["two weeks' pay", "a month's pay", "two months' pay"];
  var TASK = { rules: "the rules task", think: "the thinking task" };

  /* attention pulled onto the prize, by [prize level][base pay adequate] */
  var PULL = { 0: [22, 10], 1: [48, 21], 2: [76, 33] };

  /* how the work went — rank-only encoding, see header note */
  var RESULT = {
    rules: { 0: [56, 58], 1: [74, 76], 2: [92, 93] },
    think: { 0: [74, 78], 1: [72, 77], 2: [30, 70] }
  };

  var VERDICT = {
    rules: { 0: "gets it done", 1: "sharper", 2: "best of the three" },
    think: { 0: "gets it done", 1: "no better than the small prize", 2: "worst of all three" }
  };
  var THINK_RECOVERED = "back on form — the prize stopped mattering";

  var DISCOVERIES = [
    { id: "d1", test: function (s) { return s.task === "rules" && s.prize === 2; },
      text: "Big prize, best work — when the task is just following rules." },
    { id: "d2", test: function (s) { return s.task === "think" && s.prize === 2 && !s.paid; },
      text: "Big prize, WORST work — when the task needs thinking." },
    { id: "d3", test: function (s) { return s.task === "think" && s.prize === 1 && !s.paid; },
      text: "The middle prize changed nothing at all." },
    { id: "d4", test: function (s) { return s.prize === 2 && !s.paid; },
      text: "Turn the prize up and attention slides off the work and onto the prize." },
    { id: "d5", test: function (s) { return s.task === "rules" && s.prize === 2 && !s.paid; },
      text: "The rules task barely needs that attention — which is exactly why prizes work there." },
    { id: "d6", test: function (s) { return s.task === "think" && s.prize === 2 && s.paid; },
      text: "Pay enough that money isn't on their mind, and the big prize stops doing damage." }
  ];

  var found = {};

  var els = {
    predict: fig.querySelector("[data-rx-predict]"),
    lab: fig.querySelector("[data-rx-lab]"),
    status: fig.querySelector("[data-rx-status]"),
    workFill: fig.querySelector("[data-rx-attn-work]"),
    prizeFill: fig.querySelector("[data-rx-attn-prize]"),
    workPct: fig.querySelector("[data-rx-attn-label]"),
    resultFill: fig.querySelector("[data-rx-result-fill]"),
    verdict: fig.querySelector("[data-rx-verdict]"),
    count: fig.querySelector("[data-rx-count]")
  };

  var guess = null;

  /* Progressive enhancement: the <noscript> prose carries the finding with JS off, so only hide the
     machine once we know we can drive it. */
  if (els.lab) els.lab.hidden = true;

  function radio(name, fallback) {
    var on = fig.querySelector('input[name="' + name + '"]:checked');
    return on ? on.value : fallback;
  }

  function state() {
    return {
      prize: parseInt(radio("rx-prize", "0"), 10) || 0,
      task: radio("rx-task", "rules"),
      paid: radio("rx-pay", "low") === "enough"
    };
  }

  function pct(n) { return Math.max(0, Math.min(100, n)) + "%"; }

  function render() {
    var s = state();
    var p = s.paid ? 1 : 0;
    var onPrize = PULL[s.prize][p];
    var onWork = 100 - onPrize;
    var score = RESULT[s.task][s.prize][p];

    if (els.workFill) els.workFill.style.width = pct(onWork);
    if (els.prizeFill) els.prizeFill.style.width = pct(onPrize);
    if (els.workPct) {
      els.workPct.textContent = onWork >= 75 ? "mostly on the work"
        : onWork >= 55 ? "drifting toward the prize"
        : onWork >= 40 ? "half on the prize"
        : "mostly on the prize";
    }

    if (els.resultFill) els.resultFill.style.width = pct(score);
    var verdict = VERDICT[s.task][s.prize];
    if (s.task === "think" && s.prize === 2 && s.paid) verdict = THINK_RECOVERED;
    if (els.verdict) els.verdict.textContent = verdict;

    fig.setAttribute("data-rx-collapsed", s.task === "think" && s.prize === 2 && !s.paid ? "true" : "false");

    /* discoveries — only tick when the reader has actually produced the demonstrating state */
    var newly = [];
    DISCOVERIES.forEach(function (d) {
      if (found[d.id] || !d.test(s)) return;
      found[d.id] = true;
      newly.push(d.text);
      var li = fig.querySelector('[data-rx-find="' + d.id + '"]');
      if (li) li.setAttribute("data-found", "true");
    });
    var n = Object.keys(found).length;
    if (els.count) els.count.textContent = n + " of " + DISCOVERIES.length;

    if (els.status) {
      var msg = "Prize: " + PRIZE[s.prize] + ", base pay " + (s.paid ? "enough to forget about" : "barely enough") +
        ", on " + TASK[s.task] + ". Attention " + (els.workPct ? els.workPct.textContent : "") +
        ". Result: " + verdict + ".";
      if (newly.length) msg += " Found: " + newly.join(" ") ;
      if (n === DISCOVERIES.length) msg += " That's all six.";
      els.status.textContent = msg;
    }
  }

  fig.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.type !== "radio") return;

    if (t.name === "rx-guess") {
      guess = t.value;
      if (els.predict) els.predict.setAttribute("data-rx-answered", "true");
      if (els.lab) els.lab.hidden = false;
      var verdictLine = fig.querySelector("[data-rx-guess-echo]");
      if (verdictLine) {
        verdictLine.textContent = guess === "worse"
          ? "You're right — and almost nobody guesses that. Now find out why."
          : "Most people say that too. Turn the prize up to two months' pay and watch.";
      }
      render();
      var first = fig.querySelector('input[name="rx-prize"]');
      if (first) first.focus();
      return;
    }

    if (t.name === "rx-prize" || t.name === "rx-task" || t.name === "rx-pay") render();
  });

  render();
})();
