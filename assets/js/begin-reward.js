/* THE PRIZE MACHINE — a toy for the reward experiment described between 1:40 and 5:00 of the RSA
 * Drive animation.
 *
 * The article does the explaining. This is for digging: change the numbers and see what would be.
 *
 * TWO DIMENSIONS, because the talk describes two: how big the reward is, and whether the task is
 * mechanical or calls for thought. An earlier version also let you set the worker's normal pay and
 * watch their attention divide — neither was ever a condition anyone ran. "Pay people enough to take
 * the issue of money off the table" is a principle drawn after the result, and the talk never claims
 * attention shifts with the size of the prize. Both are gone: states nobody measured read as
 * nonsense, however carefully they are labelled.
 *
 * The outcomes are the talk's own words. Mechanical: the higher the pay, the better the performance.
 * Thinking: the medium reward did no better than the small one, and the top reward did worst of all.
 *
 * The three tested rewards are marks; straight lines join them and claim nothing in between. The
 * vertical axis carries no numbers because the result was reported as a ranking. Drag a mark to ask
 * what if it had come out otherwise — the measured shape stays behind it as a ghost.
 *
 * CSP-safe, classic IIFE, ARIA sliders, nothing encoded by hue alone. */
(function () {
  "use strict";

  var fig = document.getElementById("reward-experiment");
  if (!fig) return;
  var svg = fig.querySelector("[data-rx-svg]");
  if (!svg) return;

  /* The reward, unnamed. The salary denominations belong to the rural-India run only; the
     mechanical-versus-thinking contrast comes from the earlier US study, where the prizes were
     dollar amounts. Labelling this axis in salary put a curve nobody measured under the mechanical
     line. The denominations now appear once, in the provenance note, attached to the run they
     belong to. */
  var MARKS = ["a small reward", "a middling reward", "a large reward"];
  var TASKS = ["a mechanical task", "a task that needs thought"];

  var REAL = { rules: [56, 74, 92], think: [74, 72, 30] };
  function clone(o) { return { rules: o.rules.slice(), think: o.think.slice() }; }
  var DATA = clone(REAL);

  var state = { p: 0, task: 0, edited: false };
  function key() { return state.task === 0 ? "rules" : "think"; }
  function ys(src) { return (src || DATA)[key()]; }

  function curve(p, v) { return p <= 1 ? v[0] + (v[1] - v[0]) * p : v[1] + (v[2] - v[1]) * (p - 1); }
  function slope(p, v) { return p < 1 ? v[1] - v[0] : v[2] - v[1]; }

  /* the talk's own findings, at the three rewards it describes */
  /* Each line is what the talk reports for that case, and nothing further. */
  var SAID = {
    rules: [
      "Bonuses work the way you would expect here: the higher the pay, the better the performance.",
      "Still climbing. Higher pay, better performance.",
      "Best of the three. For work that is purely mechanical, carrots and sticks are outstanding."
    ],
    think: [
      "The smallest reward. The other two were measured against this.",
      "They did no better than the people offered the small reward.",
      "They did worst of all. A larger reward led to poorer performance."
    ]
  };

  function outcome() {
    var m = Math.round(state.p);
    if (Math.abs(state.p - m) >= 0.12) return "Between the tested rewards — nothing was measured here.";
    if (state.edited) {
      var g = slope(state.p, ys());
      return "Your version: from here a bigger reward makes it " + (g > 4 ? "better" : g < -4 ? "worse" : "no better") + ".";
    }
    return SAID[key()][m];
  }

  var VBW = 640, VBH = 300, X0 = 54, X1 = 614, Y0 = 248, Y1 = 22;
  function xOf(p) { return X0 + (p / 2) * (X1 - X0); }
  function yOf(v) { return Y0 + (v / 100) * (Y1 - Y0); }
  function vOfY(y) { return Math.max(4, Math.min(100, ((y - Y0) / (Y1 - Y0)) * 100)); }
  function pathFor(v) {
    return "M" + xOf(0) + " " + yOf(v[0]).toFixed(1) + "L" + xOf(1) + " " + yOf(v[1]).toFixed(1) +
           "L" + xOf(2) + " " + yOf(v[2]).toFixed(1);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var el = {
    active: svg.querySelector("[data-rx-path='active']"),
    other: svg.querySelector("[data-rx-path='other']"),
    ghost: svg.querySelector("[data-rx-path='ghost']"),
    dots: svg.querySelectorAll("[data-rx-dot]"),
    knob: svg.querySelector("[data-rx-knob]"),
    vline: svg.querySelector("[data-rx-vline]"),
    reset: fig.querySelector("[data-rx-reset]"),
    prov: fig.querySelector("[data-rx-prov]"),
    status: fig.querySelector("[data-rx-status]"),
    prize: fig.querySelector("[data-scrub='prize']"),
    taskEl: fig.querySelector("[data-scrub='task']"),
    outcome: fig.querySelector("[data-out='outcome']")
  };

  function render() {
    var v = ys();
    el.active.setAttribute("d", pathFor(v));
    el.other.setAttribute("d", pathFor(DATA[state.task === 0 ? "think" : "rules"]));
    if (el.ghost) el.ghost.setAttribute("d", state.edited ? pathFor(REAL[key()]) : "");

    Array.prototype.forEach.call(el.dots, function (dot) {
      var m = +dot.getAttribute("data-rx-dot");
      dot.setAttribute("cx", xOf(m));
      dot.setAttribute("cy", yOf(v[m]));
      dot.setAttribute("aria-valuenow", Math.round(v[m]));
      dot.setAttribute("aria-valuetext", "what " + MARKS[m] + " produced");
    });

    var kx = xOf(state.p), ky = yOf(curve(state.p, v));
    el.knob.setAttribute("cx", kx); el.knob.setAttribute("cy", ky);
    el.knob.setAttribute("aria-valuenow", state.p.toFixed(2));
    el.knob.setAttribute("aria-valuetext", MARKS[Math.round(state.p)] + ". " + outcome());
    el.vline.setAttribute("x1", kx); el.vline.setAttribute("x2", kx);
    el.vline.setAttribute("y1", ky); el.vline.setAttribute("y2", Y0);

    el.prize.textContent = MARKS[Math.round(state.p)];
    el.taskEl.textContent = TASKS[state.task];
    el.outcome.textContent = outcome();
    el.prize.setAttribute("aria-valuenow", String(state.p));
    el.prize.setAttribute("aria-valuetext", MARKS[Math.round(state.p)]);
    el.taskEl.setAttribute("aria-valuenow", String(state.task));
    el.taskEl.setAttribute("aria-valuetext", TASKS[state.task]);

    fig.setAttribute("data-rx-edited", state.edited ? "true" : "false");
    if (el.reset) el.reset.hidden = !state.edited;
    if (el.prov) {
      el.prov.setAttribute("data-kind", state.edited ? "yours" : "measured");
      el.prov.textContent = state.edited
        ? "Your numbers now — the faint line is what they actually found."
        : "Measured, by economists at MIT, Chicago and Carnegie Mellon. Rerun in rural India — where the three rewards were two weeks’, one month’s and two months’ wages — in case the money had not been meaningful enough the first time.";
    }
    if (el.status) el.status.textContent = MARKS[Math.round(state.p)] + " for " + TASKS[state.task] + ". " + outcome();
  }

  function scrub(node, cfg) {
    if (!node) return;
    node.setAttribute("role", "slider");
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-valuemin", String(cfg.min));
    node.setAttribute("aria-valuemax", String(cfg.max));
    node.setAttribute("aria-label", cfg.label);
    var sx = 0, sv = 0, on = false;
    node.addEventListener("pointerdown", function (e) {
      on = true; sx = e.clientX; sv = cfg.get();
      try { node.setPointerCapture(e.pointerId); } catch (err) {}
      node.setAttribute("data-dragging", "true"); e.preventDefault();
    });
    node.addEventListener("pointermove", function (e) {
      if (!on) return;
      var val = sv + (e.clientX - sx) / cfg.dragPx;
      cfg.set(clamp(cfg.step ? Math.round(val / cfg.step) * cfg.step : val, cfg.min, cfg.max)); render();
    });
    function off(e) {
      if (!on) return; on = false; node.removeAttribute("data-dragging");
      try { if (e && e.pointerId != null && node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    node.addEventListener("pointerup", off);
    node.addEventListener("pointercancel", off);
    node.addEventListener("keydown", function (e) {
      var st = cfg.keyStep || cfg.step || 1, val = cfg.get(), ok = true;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") val -= st;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") val += st;
      else if (e.key === "Home") val = cfg.min;
      else if (e.key === "End") val = cfg.max;
      else ok = false;
      if (!ok) return;
      e.preventDefault();
      cfg.set(clamp(cfg.step ? Math.round(val / cfg.step) * cfg.step : val, cfg.min, cfg.max)); render();
    });
  }
  scrub(el.prize, { label: "The reward on offer", min: 0, max: 2, step: 1, dragPx: 70, get: function () { return state.p; }, set: function (v) { state.p = v; } });
  scrub(el.taskEl, { label: "The kind of task", min: 0, max: 1, step: 1, dragPx: 55, get: function () { return state.task; }, set: function (v) { state.task = v; } });

  var sliding = false, editing = null;
  function pFromPointer(e) {
    var b = svg.getBoundingClientRect();
    return clamp((((e.clientX - b.left) / b.width) * VBW - X0) / (X1 - X0) * 2, 0, 2);
  }
  svg.addEventListener("pointerdown", function (e) {
    if (editing !== null) return;
    sliding = true; svg.setAttribute("data-dragging", "true");
    state.p = Math.round(pFromPointer(e)); render();
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  svg.addEventListener("pointermove", function (e) {
    if (editing !== null) {
      var b = svg.getBoundingClientRect();
      ys()[editing] = vOfY(((e.clientY - b.top) / b.height) * VBH);
      state.edited = true; render();
      return;
    }
    if (sliding) { state.p = Math.round(pFromPointer(e)); render(); }
  });
  function release(e) {
    sliding = false; editing = null;
    svg.removeAttribute("data-dragging");
    try { if (e && e.pointerId != null && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  Array.prototype.forEach.call(el.dots, function (dot) {
    var m = +dot.getAttribute("data-rx-dot");
    dot.setAttribute("role", "slider");
    dot.setAttribute("tabindex", "0");
    dot.setAttribute("aria-valuemin", "4");
    dot.setAttribute("aria-valuemax", "100");
    dot.setAttribute("aria-label", "What " + MARKS[m] + " produced — drag up or down to change it");
    dot.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      editing = m; state.p = m;
      try { svg.setPointerCapture(e.pointerId); } catch (err) {}
      svg.setAttribute("data-dragging", "true"); render(); e.preventDefault();
    });
    dot.addEventListener("keydown", function (e) {
      var val = ys()[m], ok = true;
      if (e.key === "ArrowUp") val += 4;
      else if (e.key === "ArrowDown") val -= 4;
      else ok = false;
      if (!ok) return;
      e.preventDefault();
      ys()[m] = clamp(val, 4, 100);
      state.edited = true; state.p = m; render();
    });
  });

  if (el.reset) el.reset.addEventListener("click", function () {
    DATA = clone(REAL); state.edited = false; render();
  });

  render();
})();
