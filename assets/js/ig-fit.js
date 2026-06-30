/* ig-fit.js — the embedded explorable in the "what AI's great at" infographic.
   Tick what's true about your task; a fit meter and a verdict update live. It's
   a rule of thumb, not a ruling — the copy keeps the call with the human.
   CSP-safe (external); verdict strings are fixed (no user input in HTML). */
(function () {
  "use strict";
  var qs = document.getElementById("rateQs");
  var fill = document.getElementById("meterFill");
  var verdict = document.getElementById("verdict");
  if (!qs || !fill || !verdict) return;

  var BASE = 55;
  var boxes = qs.querySelectorAll('input[type="checkbox"]');
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function update() {
    var score = BASE;
    boxes.forEach(function (b) { if (b.checked) score += parseInt(b.getAttribute("data-w"), 10) || 0; });
    score = clamp(score, 5, 97);
    fill.style.width = score + "%";

    var colour, html;
    if (score >= 72) {
      colour = "var(--color-success, var(--color-accent))";
      html = "<strong>Lean right in.</strong> Let it do the heavy lifting — a quick glance to check is plenty.";
    } else if (score >= 45) {
      colour = "var(--color-accent)";
      html = "<strong>A great start.</strong> Use it to draft and think — then keep a hand on the wheel and make the call yourself.";
    } else {
      colour = "var(--color-warning)";
      html = "<strong>Verify everything.</strong> Use it to get unstuck or draft, but treat every claim as a guess until you've checked it. On this one, you're the expert it isn't.";
    }
    fill.style.background = colour;
    verdict.style.borderInlineStartColor = colour;
    verdict.style.background = "color-mix(in srgb, " + colour + " 10%, transparent)";
    verdict.innerHTML = html;
    var s = verdict.querySelector("strong");
    if (s) s.style.color = colour;
  }

  boxes.forEach(function (b) { b.addEventListener("change", update); });
  update();
})();
