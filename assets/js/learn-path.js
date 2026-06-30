/* The straight line — one ordered corridor through the lessons.
   On any lesson page this renders a calm "where am I" strip in the header and
   ONE clear "next step" at the foot, read from a single ordered manifest.
   Its encouragement adapts to the reading-level setter (data-level), like
   journey.js, and visited steps are remembered in localStorage — the same
   gentle, private mechanism as the recall cards. CSP-safe (external file). */
(function () {
  "use strict";

  // One ordered source of truth: Basics -> Mental models -> The human side.
  var PATH = [
    { p: "/learn/foundations/what-is-ai.html",            t: "What AI actually is",              act: "Basics" },
    { p: "/learn/foundations/why-we-need-it.html",        t: "Why it's worth your time",         act: "Basics" },
    { p: "/learn/foundations/how-it-helps.html",          t: "How it actually helps",            act: "Basics" },
    { p: "/learn/foundations/ai-pitfalls.html",           t: "Where it slips up",                act: "Basics" },
    { p: "/learn/foundations/three-pillars.html",         t: "What makes it trustworthy",        act: "Basics" },
    { p: "/learn/frameworks/meta-cognition.html",         t: "Staying in the driver's seat",     act: "Mental models" },
    { p: "/learn/frameworks/explanation.html",            t: "Asking it to show its working",    act: "Mental models" },
    { p: "/learn/frameworks/memory-systems.html",         t: "Helping it remember",              act: "Mental models" },
    { p: "/learn/frameworks/interfaces.html",             t: "More than a chat box",             act: "Mental models" },
    { p: "/learn/frameworks/cognitive-artifacts.html",    t: "Giving it something to work with", act: "Mental models" },
    { p: "/learn/human-factors/trust-protocols.html",     t: "How much to trust it",             act: "The human side" },
    { p: "/learn/human-factors/bounded-rationality.html", t: "Making good calls",                act: "The human side" },
    { p: "/learn/human-factors/burnout-resilience.html",  t: "Looking after your energy",        act: "The human side" },
    { p: "/learn/human-factors/agency-autonomy.html",     t: "Staying the driver",               act: "The human side" }
  ];
  var TOTAL = PATH.length;

  // Where the line begins (a friendly previous for step 1) and ends (it hands
  // off into the wider Start -> Build -> Products -> Community flow).
  var START = { p: "/learn/start/new.html", t: "the gentle first step" };
  var FINISH = { href: "/build/", t: "Try making your own",
    s: ["You've been all the way through — wonderful. When you're ready, and only then, have a gentle go at building a little agent of your very own.",
        "That's the whole path. Ready to build a little agent of your own?",
        "Done. Build your own."] };

  // adaptive encouragement for the "next" sub-line, by reading level
  var SUB_NEXT = [
    "When you're ready — there's no rush at all — here's the next gentle step.",
    "Next step, whenever you're ready.",
    "Next."
  ];

  var here = location.pathname;
  var idx = -1;
  for (var i = 0; i < TOTAL; i++) { if (PATH[i].p === here) { idx = i; break; } }
  if (idx === -1) return; // not a lesson — leave journey.js to do the macro handoff

  var step = idx + 1;
  var cur = PATH[idx];

  // remember visited steps (gentle, private; same idea as the recall cards)
  var doneCount = step;
  try {
    var KEY = "mgt:path:visited";
    var seen = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (seen.indexOf(cur.p) === -1) { seen.push(cur.p); localStorage.setItem(KEY, JSON.stringify(seen)); }
    doneCount = seen.filter(function (x) {
      for (var k = 0; k < TOTAL; k++) { if (PATH[k].p === x) return true; }
      return false;
    }).length;
  } catch (e) {}

  function tier() {
    var lv = parseInt(document.documentElement.getAttribute("data-level") || "3", 10) || 3;
    return lv <= 2 ? 0 : lv === 3 ? 1 : 2;
  }

  // --- top: a quiet "where am I" strip, prepended into the lesson header ---
  var header = document.querySelector("#main-content header") || document.querySelector("main header");
  if (header) {
    var pct = Math.round((step / TOTAL) * 100);
    var strip = document.createElement("div");
    strip.className = "path-progress";
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", cur.act + ", step " + step + " of " + TOTAL);
    strip.innerHTML =
      '<span class="path-progress__where">' + cur.act + " &middot; Step " + step + " of " + TOTAL + "</span>" +
      '<span class="path-progress__track" aria-hidden="true"><span class="path-progress__fill" style="width:' + pct + '%"></span></span>' +
      '<span class="path-progress__done">' + doneCount + " of " + TOTAL + " explored</span>";
    header.insertBefore(strip, header.firstChild);
  }

  // --- bottom: ONE clear next step (drop journey.js's macro handoff first) ---
  var oldJourney = document.querySelector(".journey-next");
  if (oldJourney) oldJourney.remove();

  var footer = document.querySelector("mgt-footer") || document.querySelector("footer");
  if (!footer) return;

  var next = idx < TOTAL - 1 ? PATH[idx + 1] : null;
  var prev = idx > 0 ? PATH[idx - 1] : START;

  var nextHref = next ? next.p : FINISH.href;
  var nextLabel = next ? next.t : FINISH.t;
  var kicker = next ? ("Next &middot; Step " + (step + 1) + " of " + TOTAL) : "You've reached the end of the path";

  var nav = document.createElement("nav");
  nav.className = "path-next";
  nav.setAttribute("aria-label", "Lesson navigation");
  nav.innerHTML =
    '<div class="path-next__inner">' +
      '<span class="path-next__kicker">' + kicker + "</span>" +
      '<a class="path-next__go" href="' + nextHref + '"><strong>' + nextLabel + " &rarr;</strong>" +
        '<span class="path-next__sub"></span></a>' +
      '<div class="path-next__aside">' +
        '<a class="path-next__prev" href="' + prev.p + '">&larr; ' + (prev.t || "Previous") + "</a>" +
        '<a class="path-next__map" href="/learn/">Jump around the map</a>' +
      "</div>" +
    "</div>";
  footer.parentNode.insertBefore(nav, footer);

  // keep the encouragement in sync with the reading-level setter
  var sub = nav.querySelector(".path-next__sub");
  function paint() { sub.textContent = next ? SUB_NEXT[tier()] : FINISH.s[tier()]; }
  paint();
  if (window.MutationObserver) {
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-level"] });
  }
})();
