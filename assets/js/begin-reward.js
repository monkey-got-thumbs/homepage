/* THE PRIZE MACHINE — a toy for the reward experiment described between 3:26 and 5:32 of the RSA
 * Drive animation (the Madurai replication).
 *
 * The article does the explaining. This is for digging: change the numbers and see what would be.
 *
 * One bound state, enterable from any end —
 *   drag the knob along the curve · drag the underlined values in the sentence ·
 *   drag the attention split (runs the model backwards) · drag the measured marks themselves
 *
 * Dragging a mark asks "what if it had come out otherwise". The measured result stays behind it as a
 * ghost and a reset puts it back, so the real finding is never silently overwritten.
 *
 * The curve is the quadratic through whatever the three marks currently say — so the marks are the
 * truth and the line is only a way of getting between them. The vertical axis carries no numbers
 * because the study reported which group did better, never by how much.
 *
 * CSP-safe, classic IIFE, ARIA sliders throughout, nothing encoded by hue alone. */
(function () {
  "use strict";

  var fig = document.getElementById("reward-experiment");
  if (!fig) return;
  var svg = fig.querySelector("[data-rx-svg]");
  if (!svg) return;

  var MARKS = ["two weeks' pay", "a month's pay", "two months' pay"];
  var TASKS = ["a task with clear rules", "a task that needs thinking"];
  var PAYS = ["barely enough", "enough to forget about"];

  /* what was measured — ordinal, so these are ranks drawn as heights, never scores */
  var REAL = { rules: [[56, 74, 92], [58, 76, 93]], think: [[74, 72, 30], [78, 77, 70]] };
  function clone(o) {
    return { rules: [o.rules[0].slice(), o.rules[1].slice()], think: [o.think[0].slice(), o.think[1].slice()] };
  }
  var DATA = clone(REAL);

  var state = { p: 0, task: 0, pay: 0, edited: false };
  function key() { return state.task === 0 ? "rules" : "think"; }
  function ys(src) { return (src || DATA)[key()][state.pay]; }

  function curve(p, v) { return v[0] * (p - 1) * (p - 2) / 2 - v[1] * p * (p - 2) + v[2] * p * (p - 1) / 2; }
  function pull(p, pay) { return pay === 0 ? p * p + 25 * p + 22 : 0.5 * p * p + 10.5 * p + 10; }
  function prizeForPull(a, pay) {
    var p = pay === 0 ? (-25 + Math.sqrt(625 - 4 * (22 - a))) / 2
                      : (-21 + Math.sqrt(441 - 4 * (20 - 2 * a))) / 2;
    return Math.max(0, Math.min(2, p));
  }

  /* verdicts read off the marks, so they stay true after you have moved them */
  function verdictAt(m, v) {
    var hi = Math.max(v[0], v[1], v[2]), lo = Math.min(v[0], v[1], v[2]);
    if (hi - lo < 3) return "much the same either way";
    if (m > 0 && Math.abs(v[m] - v[m - 1]) < 3) return "no better than the smaller prize";
    if (v[m] >= hi - 0.5) return "the best of the three";
    if (v[m] <= lo + 0.5) return "the worst of the three";
    return "somewhere in the middle";
  }
  function verdict() {
    var m = Math.round(state.p);
    return Math.abs(state.p - m) >= 0.12 ? "somewhere in between" : verdictAt(m, ys());
  }
  function attnWords(w) {
    return w >= 75 ? "mostly on the work" : w >= 55 ? "drifting off the work"
      : w >= 40 ? "half on the prize" : "mostly on the prize";
  }

  var VBW = 640, VBH = 300, X0 = 54, X1 = 614, Y0 = 248, Y1 = 22;
  function xOf(p) { return X0 + (p / 2) * (X1 - X0); }
  function yOf(v) { return Y0 + (v / 100) * (Y1 - Y0); }
  function vOfY(y) { return Math.max(4, Math.min(100, ((y - Y0) / (Y1 - Y0)) * 100)); }
  function pathFor(v) {
    var d = "";
    for (var i = 0; i <= 60; i++) { var p = (i / 60) * 2; d += (i ? "L" : "M") + xOf(p).toFixed(1) + " " + yOf(curve(p, v)).toFixed(1); }
    return d;
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
    attnBar: fig.querySelector("[data-rx-attn]"),
    grip: fig.querySelector("[data-rx-grip]"),
    attnWork: fig.querySelector("[data-rx-attn-work]"),
    attnPrize: fig.querySelector("[data-rx-attn-prize]"),
    status: fig.querySelector("[data-rx-status]"),
    o: {
      prize: fig.querySelector("[data-scrub='prize']"),
      task: fig.querySelector("[data-scrub='task']"),
      pay: fig.querySelector("[data-scrub='pay']"),
      attn: fig.querySelector("[data-out='attn']"),
      verdict: fig.querySelector("[data-out='verdict']")
    }
  };

  function render() {
    var v = ys(), otherKey = state.task === 0 ? "think" : "rules";
    el.active.setAttribute("d", pathFor(v));
    el.other.setAttribute("d", pathFor(DATA[otherKey][state.pay]));
    if (el.ghost) el.ghost.setAttribute("d", state.edited ? pathFor(REAL[key()][state.pay]) : "");

    Array.prototype.forEach.call(el.dots, function (dot) {
      var m = +dot.getAttribute("data-rx-dot");
      dot.setAttribute("cx", xOf(m));
      dot.setAttribute("cy", yOf(v[m]));
      dot.setAttribute("aria-valuenow", Math.round(v[m]));
      dot.setAttribute("aria-valuetext", MARKS[m] + " — " + verdictAt(m, v));
    });

    var kx = xOf(state.p), ky = yOf(curve(state.p, v));
    el.knob.setAttribute("cx", kx); el.knob.setAttribute("cy", ky);
    el.knob.setAttribute("aria-valuenow", state.p.toFixed(2));
    el.knob.setAttribute("aria-valuetext", MARKS[Math.round(state.p)] + ", " + verdict());
    el.vline.setAttribute("x1", kx); el.vline.setAttribute("x2", kx);
    el.vline.setAttribute("y1", ky); el.vline.setAttribute("y2", Y0);

    var onPrize = pull(state.p, state.pay), onWork = 100 - onPrize;
    el.attnWork.style.width = onWork.toFixed(1) + "%";
    el.attnPrize.style.width = onPrize.toFixed(1) + "%";
    if (el.grip) el.grip.style.left = onWork.toFixed(1) + "%";
    if (el.attnBar) {
      el.attnBar.setAttribute("aria-valuenow", Math.round(onWork));
      el.attnBar.setAttribute("aria-valuetext", Math.round(onWork) + "% on the work — " + attnWords(onWork));
    }

    var near = Math.abs(state.p - Math.round(state.p)) < 0.12;
    el.o.prize.textContent = MARKS[Math.round(state.p)] + (near ? "" : " (ish)");
    el.o.task.textContent = TASKS[state.task];
    el.o.pay.textContent = PAYS[state.pay];
    el.o.attn.textContent = attnWords(onWork);
    el.o.verdict.textContent = verdict();
    [["prize", state.p, MARKS[Math.round(state.p)]], ["task", state.task, TASKS[state.task]], ["pay", state.pay, PAYS[state.pay]]]
      .forEach(function (r) {
        el.o[r[0]].setAttribute("aria-valuenow", String(r[1]));
        el.o[r[0]].setAttribute("aria-valuetext", r[2]);
      });

    fig.setAttribute("data-rx-edited", state.edited ? "true" : "false");
    if (el.reset) el.reset.hidden = !state.edited;

    if (el.status) {
      el.status.textContent = MARKS[Math.round(state.p)] + " for " + TASKS[state.task] + ", normal pay " +
        PAYS[state.pay] + ". Attention " + attnWords(onWork) + ". The work comes out " + verdict() + "." +
        (state.edited ? " These are your numbers now, not the measured ones." : "");
    }
  }

  /* scrubbable values in the sentence */
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
      cfg.set(clamp(cfg.step ? Math.round(val / cfg.step) * cfg.step : val, cfg.min, cfg.max));
      render();
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
      cfg.set(clamp(cfg.step ? Math.round(val / cfg.step) * cfg.step : val, cfg.min, cfg.max));
      render();
    });
  }
  scrub(el.o.prize, { label: "The prize on offer", min: 0, max: 2, keyStep: 0.25, dragPx: 90, get: function () { return state.p; }, set: function (v) { state.p = v; } });
  scrub(el.o.task, { label: "The kind of task", min: 0, max: 1, step: 1, dragPx: 55, get: function () { return state.task; }, set: function (v) { state.task = v; } });
  scrub(el.o.pay, { label: "Their normal pay", min: 0, max: 1, step: 1, dragPx: 55, get: function () { return state.pay; }, set: function (v) { state.pay = v; } });

  /* the knob slides along the curve; a mark being dragged takes precedence */
  var sliding = false, editing = null;
  function pFromPointer(e) {
    var b = svg.getBoundingClientRect();
    return clamp((((e.clientX - b.left) / b.width) * VBW - X0) / (X1 - X0) * 2, 0, 2);
  }
  svg.addEventListener("pointerdown", function (e) {
    if (editing !== null) return;
    sliding = true; svg.setAttribute("data-dragging", "true");
    state.p = pFromPointer(e); render();
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
    if (sliding) { state.p = pFromPointer(e); render(); }
  });
  function release(e) {
    sliding = false; editing = null;
    svg.removeAttribute("data-dragging");
    try { if (e && e.pointerId != null && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  /* the marks themselves are draggable — this is the "what if" */
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
      svg.setAttribute("data-dragging", "true");
      render(); e.preventDefault();
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

  /* the attention split runs the model backwards */
  if (el.attnBar) {
    var barOn = false;
    function workFrom(e) { var b = el.attnBar.getBoundingClientRect(); return clamp(((e.clientX - b.left) / b.width) * 100, 0, 100); }
    function setWork(w) { state.p = prizeForPull(100 - w, state.pay); render(); }
    el.attnBar.addEventListener("pointerdown", function (e) {
      barOn = true; el.attnBar.setAttribute("data-dragging", "true");
      try { el.attnBar.setPointerCapture(e.pointerId); } catch (err) {}
      setWork(workFrom(e)); e.preventDefault();
    });
    el.attnBar.addEventListener("pointermove", function (e) { if (barOn) setWork(workFrom(e)); });
    function barOff(e) {
      if (!barOn) return; barOn = false; el.attnBar.removeAttribute("data-dragging");
      try { if (e && e.pointerId != null && el.attnBar.hasPointerCapture(e.pointerId)) el.attnBar.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    el.attnBar.addEventListener("pointerup", barOff);
    el.attnBar.addEventListener("pointercancel", barOff);
    el.attnBar.addEventListener("keydown", function (e) {
      var w = 100 - pull(state.p, state.pay), ok = true;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") w -= 4;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") w += 4;
      else if (e.key === "Home") w = 0;
      else if (e.key === "End") w = 100;
      else ok = false;
      if (!ok) return;
      e.preventDefault(); setWork(clamp(w, 0, 100));
    });
  }

  render();
})();
