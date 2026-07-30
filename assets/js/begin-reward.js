/* THE PRIZE MACHINE — a reactive document for the reward experiment described between 3:26 and 5:32
 * of the RSA Drive animation (the Madurai replication).
 *
 * Two views of one state, bound both ways:
 *   - a line graph with a knob you drag along the curve
 *   - a sentence whose values are scrubbable (dotted underline, drag left/right), Tangle-style
 * Move either and the other follows. Selects scrub the same way as numbers.
 *
 * WHAT IS MEASURED AND WHAT IS MODEL — do not blur this:
 *   - Measured: three prize levels (two weeks', one month', two months' pay), reported ORDINALLY —
 *     which group did better, never by how much. Those three are drawn as solid marks. The curve
 *     between them is drawn dashed because its shape is interpolation, not data. The y axis carries
 *     no numbers for the same reason.
 *   - Model: the attention split, and the normal-pay dial. The talk states the principle — "pay
 *     people enough to take the issue of money off the table... so they're not thinking about money
 *     and they're thinking about the work" — but base pay was not a condition that was run.
 *
 * Curves are quadratics fitted exactly through the three ordinal marks, so the marks are the truth
 * and the line is only a way of getting between them.
 *
 * CSP-safe (external, same-origin). Classic IIFE. Every control is a real ARIA slider with keyboard
 * support; nothing depends on hue alone. */
(function () {
  "use strict";

  var fig = document.getElementById("reward-experiment");
  if (!fig) return;

  var svg = fig.querySelector("[data-rx-svg]");
  if (!svg) return;

  /* ---------------------------------------------------------------- model */

  var MARKS = ["two weeks' pay", "a month's pay", "two months' pay"];
  var TASKS = ["a task with clear rules", "a task that needs thinking"];
  var PAYS = ["barely enough", "enough to forget about"];

  /* result(prize) — quadratics through the three ordinal marks */
  function result(p, task, pay) {
    if (task === 0) return 56 + 18 * p;                    // rules: 56 / 74 / 92
    return pay === 0 ? -20 * p * p + 18 * p + 74           // thinking, poorly paid: 74 / 72 / 30
                     : -3 * p * p + 2 * p + 78;            // thinking, paid enough: 78 / 77 / 70
  }
  /* attention pulled onto the prize */
  function pull(p, pay) {
    return pay === 0 ? p * p + 25 * p + 22 : 0.5 * p * p + 10.5 * p + 10;
  }
  /* ...and its inverse, so the attention bar can be dragged to set the prize. Both branches are
     monotonic over the prize range, so this is a straight positive-root solve. Attention outside the
     reachable band just clamps — which is itself the lesson: when someone is paid properly you
     cannot drag their attention badly off the work, because the prize has lost its grip. */
  function prizeForPull(a, pay) {
    var p = pay === 0
      ? (-25 + Math.sqrt(625 - 4 * (22 - a))) / 2
      : (-21 + Math.sqrt(441 - 4 * (20 - 2 * a))) / 2;
    return Math.max(0, Math.min(2, p));
  }

  function verdictFor(p, task, pay) {
    var near = Math.abs(p - Math.round(p)) < 0.12;
    var m = Math.round(p);
    if (!near) return "somewhere in between — untested ground";
    if (task === 0) return ["fine", "sharper", "best of the three"][m];
    if (pay === 1) return m === 2 ? "unharmed — the prize stopped mattering"
                                  : ["fine", "much the same"][m];
    return ["fine", "no better than the small prize", "worst of all three"][m];
  }

  function attnWords(onWork) {
    return onWork >= 75 ? "mostly on the work"
      : onWork >= 55 ? "drifting off the work"
      : onWork >= 40 ? "half on the prize"
      : "mostly on the prize";
  }

  var state = { p: 0, task: 0, pay: 0 };

  /* ------------------------------------------------------------ geometry */

  var VB = { w: 640, h: 300, l: 54, r: 26, t: 22, b: 52 };
  var X0 = VB.l, X1 = VB.w - VB.r, Y0 = VB.h - VB.b, Y1 = VB.t;
  var xOf = function (p) { return X0 + (p / 2) * (X1 - X0); };
  var yOf = function (v) { return Y0 + (v / 100) * (Y1 - Y0); };
  var pOfX = function (x) { return Math.max(0, Math.min(2, ((x - X0) / (X1 - X0)) * 2)); };

  function pathFor(task, pay) {
    var d = "", n = 60;
    for (var i = 0; i <= n; i++) {
      var p = (i / n) * 2;
      d += (i ? "L" : "M") + xOf(p).toFixed(1) + " " + yOf(result(p, task, pay)).toFixed(1);
    }
    return d;
  }

  /* -------------------------------------------------------------- refs */

  var el = {
    lab: fig.querySelector("[data-rx-lab]"),
    predict: fig.querySelector("[data-rx-predict]"),
    echo: fig.querySelector("[data-rx-guess-echo]"),
    pathRules: svg.querySelector("[data-rx-path='rules']"),
    pathThink: svg.querySelector("[data-rx-path='think']"),
    dots: svg.querySelectorAll("[data-rx-dot]"),
    knob: svg.querySelector("[data-rx-knob]"),
    vline: svg.querySelector("[data-rx-vline]"),
    hline: svg.querySelector("[data-rx-hline]"),
    attnBar: fig.querySelector("[data-rx-attn]"),
    grip: fig.querySelector("[data-rx-grip]"),
    attnWork: fig.querySelector("[data-rx-attn-work]"),
    attnPrize: fig.querySelector("[data-rx-attn-prize]"),
    status: fig.querySelector("[data-rx-status]"),
    count: fig.querySelector("[data-rx-count]"),
    outs: {
      prize: fig.querySelector("[data-scrub='prize']"),
      task: fig.querySelector("[data-scrub='task']"),
      pay: fig.querySelector("[data-scrub='pay']"),
      attn: fig.querySelector("[data-out='attn']"),
      verdict: fig.querySelector("[data-out='verdict']")
    }
  };

  if (el.lab) el.lab.hidden = true;

  /* ------------------------------------------------------- discoveries */

  var FINDS = [
    { id: "d1", t: function (s) { return s.task === 0 && s.p > 1.85; } },
    { id: "d2", t: function (s) { return s.task === 1 && s.p > 1.85 && s.pay === 0; } },
    { id: "d3", t: function (s) { return s.task === 1 && Math.abs(s.p - 1) < 0.12 && s.pay === 0; } },
    { id: "d4", t: function (s) { return s.p > 1.85 && s.pay === 0; } },
    { id: "d5", t: function (s) { return s.task === 0 && s.p > 1.5 && s.pay === 0; } },
    { id: "d6", t: function (s) { return s.task === 1 && s.p > 1.85 && s.pay === 1; } }
  ];
  var found = {};

  /* ----------------------------------------------------------- render */

  function render() {
    var res = result(state.p, state.task, state.pay);
    var onPrize = pull(state.p, state.pay);
    var onWork = 100 - onPrize;

    el.pathRules.setAttribute("d", pathFor(0, state.pay));
    el.pathThink.setAttribute("d", pathFor(1, state.pay));
    el.pathRules.setAttribute("data-active", state.task === 0 ? "true" : "false");
    el.pathThink.setAttribute("data-active", state.task === 1 ? "true" : "false");

    Array.prototype.forEach.call(el.dots, function (dot) {
      var m = parseInt(dot.getAttribute("data-rx-dot"), 10);
      dot.setAttribute("cx", xOf(m));
      dot.setAttribute("cy", yOf(result(m, state.task, state.pay)));
    });

    var kx = xOf(state.p), ky = yOf(res);
    el.knob.setAttribute("cx", kx);
    el.knob.setAttribute("cy", ky);
    el.knob.setAttribute("aria-valuenow", state.p.toFixed(2));
    el.knob.setAttribute("aria-valuetext", MARKS[Math.round(state.p)] + ", " + verdictFor(state.p, state.task, state.pay));
    el.vline.setAttribute("x1", kx); el.vline.setAttribute("x2", kx);
    el.vline.setAttribute("y1", ky); el.vline.setAttribute("y2", Y0);
    el.hline.setAttribute("x1", X0); el.hline.setAttribute("x2", kx);
    el.hline.setAttribute("y1", ky); el.hline.setAttribute("y2", ky);

    if (el.attnWork) el.attnWork.style.width = onWork.toFixed(1) + "%";
    if (el.attnPrize) el.attnPrize.style.width = onPrize.toFixed(1) + "%";
    if (el.grip) el.grip.style.left = onWork.toFixed(1) + "%";
    if (el.attnBar) {
      el.attnBar.setAttribute("aria-valuenow", Math.round(onWork));
      el.attnBar.setAttribute("aria-valuetext", Math.round(onWork) + "% on the work — " + attnWords(onWork));
    }

    var nearMark = Math.abs(state.p - Math.round(state.p)) < 0.12;
    fig.setAttribute("data-rx-untested", nearMark ? "false" : "true");
    fig.setAttribute("data-rx-collapsed", state.task === 1 && state.p > 1.6 && state.pay === 0 ? "true" : "false");

    var o = el.outs;
    o.prize.textContent = MARKS[Math.round(state.p)] + (nearMark ? "" : " (ish)");
    o.task.textContent = TASKS[state.task];
    o.pay.textContent = PAYS[state.pay];
    o.attn.textContent = attnWords(onWork);
    o.verdict.textContent = verdictFor(state.p, state.task, state.pay);

    [["prize", state.p, MARKS[Math.round(state.p)]], ["task", state.task, TASKS[state.task]], ["pay", state.pay, PAYS[state.pay]]]
      .forEach(function (row) {
        var node = o[row[0]];
        node.setAttribute("aria-valuenow", String(row[1]));
        node.setAttribute("aria-valuetext", row[2]);
      });

    var newly = [];
    FINDS.forEach(function (f) {
      if (found[f.id] || !f.t(state)) return;
      found[f.id] = true;
      var li = fig.querySelector("[data-rx-find='" + f.id + "']");
      if (li) { li.setAttribute("data-found", "true"); newly.push(li.textContent.trim()); }
    });
    var n = Object.keys(found).length;
    if (el.count) el.count.textContent = n + " of " + FINDS.length;

    if (el.status) {
      el.status.textContent = "Prize " + MARKS[Math.round(state.p)] + ", " + TASKS[state.task] +
        ", normal pay " + PAYS[state.pay] + ". Attention " + attnWords(onWork) + ". Result: " +
        verdictFor(state.p, state.task, state.pay) + "." +
        (newly.length ? " Found: " + newly.join(" ") : "") +
        (n === FINDS.length ? " That is all six." : "");
    }
  }

  /* ------------------------------------------------- scrubbable values */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* Turns a span into a draggable value. dragPx is how far the pointer travels per unit. */
  function scrub(node, cfg) {
    if (!node) return;
    node.setAttribute("role", "slider");
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-valuemin", String(cfg.min));
    node.setAttribute("aria-valuemax", String(cfg.max));
    node.setAttribute("aria-label", cfg.label);

    var startX = 0, startV = 0, dragging = false;

    node.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; startV = cfg.get();
      try { node.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      node.setAttribute("data-dragging", "true");
      e.preventDefault();
    });
    node.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var v = startV + (e.clientX - startX) / cfg.dragPx;
      cfg.set(clamp(cfg.step ? Math.round(v / cfg.step) * cfg.step : v, cfg.min, cfg.max));
      render();
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      node.removeAttribute("data-dragging");
      try { if (e && e.pointerId != null && node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
    node.addEventListener("pointerup", end);
    node.addEventListener("pointercancel", end);

    node.addEventListener("keydown", function (e) {
      var step = cfg.keyStep || cfg.step || 1;
      var v = cfg.get(), handled = true;
      switch (e.key) {
        case "ArrowLeft": case "ArrowDown": v -= step; break;
        case "ArrowRight": case "ArrowUp": v += step; break;
        case "Home": v = cfg.min; break;
        case "End": v = cfg.max; break;
        case "PageDown": v -= step * 2; break;
        case "PageUp": v += step * 2; break;
        default: handled = false;
      }
      if (!handled) return;
      e.preventDefault();
      cfg.set(clamp(cfg.step ? Math.round(v / cfg.step) * cfg.step : v, cfg.min, cfg.max));
      render();
    });
  }

  scrub(el.outs.prize, {
    label: "The prize on offer", min: 0, max: 2, keyStep: 0.25, dragPx: 90,
    get: function () { return state.p; }, set: function (v) { state.p = v; }
  });
  scrub(el.outs.task, {
    label: "The kind of task", min: 0, max: 1, step: 1, dragPx: 55,
    get: function () { return state.task; }, set: function (v) { state.task = v; }
  });
  scrub(el.outs.pay, {
    label: "Their normal pay", min: 0, max: 1, step: 1, dragPx: 55,
    get: function () { return state.pay; }, set: function (v) { state.pay = v; }
  });

  /* -------------------------------------------------- the graph knob */

  function pointerToP(e) {
    var box = svg.getBoundingClientRect();
    var x = ((e.clientX - box.left) / box.width) * VB.w;
    return pOfX(x);
  }

  var knobDragging = false;
  function grab(e) {
    knobDragging = true;
    svg.setAttribute("data-dragging", "true");
    state.p = pointerToP(e);
    render();
    try { if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    e.preventDefault();
  }
  svg.addEventListener("pointerdown", grab);
  svg.addEventListener("pointermove", function (e) {
    if (!knobDragging) return;
    state.p = pointerToP(e);
    render();
  });
  function drop(e) {
    if (!knobDragging) return;
    knobDragging = false;
    svg.removeAttribute("data-dragging");
    try { if (e && e.pointerId != null && svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
  }
  svg.addEventListener("pointerup", drop);
  svg.addEventListener("pointercancel", drop);

  el.knob.setAttribute("role", "slider");
  el.knob.setAttribute("tabindex", "0");
  el.knob.setAttribute("aria-valuemin", "0");
  el.knob.setAttribute("aria-valuemax", "2");
  el.knob.setAttribute("aria-label", "The prize on offer — drag along the curve");
  el.knob.addEventListener("keydown", function (e) {
    var v = state.p, handled = true;
    switch (e.key) {
      case "ArrowLeft": case "ArrowDown": v -= 0.25; break;
      case "ArrowRight": case "ArrowUp": v += 0.25; break;
      case "Home": v = 0; break;
      case "End": v = 2; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    state.p = clamp(v, 0, 2);
    render();
  });

  /* The attention bar drives the model backwards: set where their head is, and the prize that would
     put it there follows. Same state as the knob and the sentence — just entered from the other end. */
  if (el.attnBar) {
    var barDragging = false;

    function attnFromPointer(e) {
      var box = el.attnBar.getBoundingClientRect();
      var onWork = ((e.clientX - box.left) / box.width) * 100;
      return Math.max(0, Math.min(100, onWork));
    }
    function setFromWork(onWork) {
      state.p = prizeForPull(100 - onWork, state.pay);
      render();
    }

    el.attnBar.addEventListener("pointerdown", function (e) {
      barDragging = true;
      el.attnBar.setAttribute("data-dragging", "true");
      try { el.attnBar.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      setFromWork(attnFromPointer(e));
      e.preventDefault();
    });
    el.attnBar.addEventListener("pointermove", function (e) {
      if (!barDragging) return;
      setFromWork(attnFromPointer(e));
    });
    function barDrop(e) {
      if (!barDragging) return;
      barDragging = false;
      el.attnBar.removeAttribute("data-dragging");
      try { if (e && e.pointerId != null && el.attnBar.hasPointerCapture(e.pointerId)) el.attnBar.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    }
    el.attnBar.addEventListener("pointerup", barDrop);
    el.attnBar.addEventListener("pointercancel", barDrop);

    el.attnBar.addEventListener("keydown", function (e) {
      var onWork = 100 - pull(state.p, state.pay), handled = true;
      switch (e.key) {
        case "ArrowLeft": case "ArrowDown": onWork -= 4; break;
        case "ArrowRight": case "ArrowUp": onWork += 4; break;
        case "Home": onWork = 0; break;
        case "End": onWork = 100; break;
        default: handled = false;
      }
      if (!handled) return;
      e.preventDefault();
      setFromWork(Math.max(0, Math.min(100, onWork)));
    });
  }

  /* clicking a tested mark snaps to it */
  Array.prototype.forEach.call(el.dots, function (dot) {
    dot.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      state.p = parseInt(dot.getAttribute("data-rx-dot"), 10);
      render();
    });
  });

  /* ------------------------------------------------------ the gate */

  fig.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.name !== "rx-guess") return;
    if (el.predict) el.predict.setAttribute("data-rx-answered", "true");
    if (el.lab) el.lab.hidden = false;
    if (el.echo) {
      el.echo.textContent = t.value === "worse"
        ? "Right — and almost nobody guesses that. Drag the prize up and see why."
        : "Most people say that too. Drag the prize up to two months' pay and watch what happens.";
    }
    render();
    if (el.outs.prize) el.outs.prize.focus();
  });

  render();
})();
