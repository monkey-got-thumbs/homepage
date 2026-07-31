/* HOW FAR YOU GET — a reach plot.
 *
 * Nine things from an ordinary life, laid out left to right by how much there is to HOLD AT ONCE —
 * volume, not difficulty. The barrier on the first seven is not that they are hard to understand, it
 * is that there is more of them than fits in a head, so they stay undone. That is the whole point:
 * an earlier list drifted into comprehension and decisions, which is a different problem.
 * The reader drags a line to where they get to on their own. That line is their own, and it is the
 * only data in the figure. Then one lever adds something that will explain anything, and a second,
 * further reach appears — sweeping several of the things they had left behind.
 *
 * The rule this exists to satisfy: nothing may tell the reader that AI can help them. There is no
 * sentence anywhere that says so. They set their own line, they pull the lever, they watch what gets
 * covered, and the conclusion is theirs.
 *
 * Two things sit past the point the assisted reach can ever get to — and the cap is fixed, so no
 * matter how far the reader drags their own line, those two are never covered. They are choices, not
 * questions, and explaining does not touch a choice. Nothing says this; the reader can simply see
 * that the shading stops short of them however hard they push.
 *
 * One thing crosses but is marked worth checking, because a version showing only upside would be
 * lying by omission — in the BCG trial (Dell'Acqua et al. 2023) people working outside the model's
 * frontier were faster, more confident and measurably wronger.
 *
 * The horizontal axis has no numbers and no scale. It is an ordering, which is all that can honestly
 * be claimed: no measured scale of problem difficulty exists.
 *
 * CSP-safe, classic IIFE, ARIA slider, nothing carried by hue alone. */
(function () {
  "use strict";

  var fig = document.getElementById("reach-ladder");
  if (!fig) return;
  var plot = fig.querySelector("[data-lad-plot]");
  if (!plot) return;

  /* x is position along the ordering, 0..1. out: what happens when the lever is on. */
  var THINGS = [
    { x: 0.06, out: "moves", text: "Which bills renew this month, and at what" },
    { x: 0.15, out: "moves", text: "What everyone in the house needs this week" },
    { x: 0.30, out: "moves", text: "Where the money actually went last month" },
    { x: 0.41, out: "moves", text: "Every school letter, form and deadline this term" },
    { x: 0.53, out: "moves", text: "What fourteen energy tariffs would really cost you" },
    { x: 0.64, out: "moves", text: "Eleven years of photos, and which are worth keeping" },
    { x: 0.76, out: "check", text: "What changed in the forty-page tenancy agreement" },
    { x: 0.90, out: "never", text: "Whether to move nearer your parents" },
    { x: 0.96, out: "never", text: "Whether to leave a job you are good at" }
  ];

  var BOOST = 0.42;   /* how much further the assisted reach goes */
  /* The furthest ANY reach gets — the reader's own line as well as the assisted one. The axis is
     really "how far knowing gets you", and knowing runs out before the last two whoever you are.
     Without capping the reader's own drag they could sweep the choices by claiming competence, which
     would say the choices are merely harder — the opposite of the point. */
  var CAP = 0.83;

  var reach = 0.18;
  var lever = false;

  var handle = fig.querySelector("[data-lad-handle]");
  var mine = fig.querySelector("[data-lad-mine]");
  var extra = fig.querySelector("[data-lad-extra]");
  var leverBtn = fig.querySelector("[data-lad-lever]");
  var countEl = fig.querySelector("[data-lad-count]");
  var statusEl = fig.querySelector("[data-lad-status]");
  var rows = fig.querySelectorAll("[data-lad-row]");
  var bars = fig.querySelectorAll("[data-lad-bar]");

  function assisted() { return lever ? Math.min(reach + BOOST, CAP) : reach; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pct(v) { return (v * 100).toFixed(1) + "%"; }

  function stateOf(i) {
    var t = THINGS[i];
    if (t.x <= reach) return "yours";
    if (lever && t.x <= assisted()) return t.out === "check" ? "check" : "moves";
    return "out";
  }

  function render() {
    var a = assisted(), swept = 0, beyond = 0;

    /* one update point: every row's shading and line read these two properties */
    plot.style.setProperty("--reach", pct(reach));
    plot.style.setProperty("--assist", pct(a));
    if (handle) {
      handle.style.left = pct(reach);
      handle.setAttribute("aria-valuenow", Math.round(reach * 100));
      handle.setAttribute("aria-valuetext", "you reach " +
        THINGS.filter(function (t) { return t.x <= reach; }).length + " of the nine on your own");
    }

    Array.prototype.forEach.call(rows, function (row) {
      var i = +row.getAttribute("data-lad-row");
      var st = stateOf(i);
      row.setAttribute("data-state", st);
      var bar = bars[i];
      if (bar) bar.style.setProperty("--x", pct(THINGS[i].x));
      var tag = row.querySelector("[data-lad-tag]");
      if (tag) tag.textContent = st === "moves" ? "now in reach"
        : st === "check" ? "in reach — worth checking" : "";
      if (st === "moves" || st === "check") swept++;
      if (lever && THINGS[i].x > a) beyond++;
    });

    fig.setAttribute("data-lad-on", lever ? "true" : "false");
    if (leverBtn) leverBtn.setAttribute("aria-pressed", lever ? "true" : "false");

    if (countEl) {
      countEl.textContent = !lever ? ""
        : swept + (swept === 1 ? " came into reach" : " came into reach") +
          (beyond ? " · " + beyond + " still out" : "");
    }
    if (statusEl) {
      statusEl.textContent = lever
        ? swept + " more of the nine came into reach. " + (beyond ? beyond + " did not." : "")
        : THINGS.filter(function (t) { return t.x <= reach; }).length + " of the nine within your reach.";
    }
  }

  /* dragging the line */
  function fromPointer(e) {
    var g = fig.querySelector(".lad-gauge");
    var b = g.getBoundingClientRect();
    return clamp((e.clientX - b.left) / b.width, 0, CAP);
  }
  var dragging = false;
  function grab(e) {
    dragging = true;
    plot.setAttribute("data-dragging", "true");
    reach = fromPointer(e); render();
    try { plot.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }
  plot.addEventListener("pointerdown", grab);
  plot.addEventListener("pointermove", function (e) { if (dragging) { reach = fromPointer(e); render(); } });
  function drop(e) {
    if (!dragging) return;
    dragging = false;
    plot.removeAttribute("data-dragging");
    try { if (e && e.pointerId != null && plot.hasPointerCapture(e.pointerId)) plot.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  plot.addEventListener("pointerup", drop);
  plot.addEventListener("pointercancel", drop);

  if (handle) handle.addEventListener("keydown", function (e) {
    var v = reach, ok = true;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") v -= 0.05;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") v += 0.05;
    else if (e.key === "Home") v = 0;
    else if (e.key === "End") v = CAP;
    else ok = false;
    if (!ok) return;
    e.preventDefault();
    reach = clamp(v, 0, CAP); render();
  });

  if (leverBtn) leverBtn.addEventListener("click", function () { lever = !lever; render(); });

  render();
})();
