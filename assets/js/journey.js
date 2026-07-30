/* Journey continuity — a gentle "next step" handoff at the foot of each stage,
   so the IA's Basics → Discover → Explore → Build loop is felt, not just
   labelled. CSP-safe (external). Injected above <mgt-footer>; no-ops elsewhere.
   The blurb adapts to the reading-level setter (data-level on <html>). */
(function () {
  "use strict";
  if (document.querySelector(".journey-next") || document.querySelector(".path-next")) return;
  var p = location.pathname.replace(/index\.html$/, "");
  if (/\/(advisor|chatty|metron|writers-digest)(\/|$)/.test(p)) return;

  // s = [low (frustrated/verbose), mid (default), high (patronising/terse)]
  // The arc follows the new IA — basics → discover → explore → build — and then
  // closes Fan's loop (build → discover again, one rung higher). Legacy pages kept.
  var MAP = [
    // Hub + memory only — the five concept reads carry their own prev/next
    // reading-order nav, so a second "next step" card there would conflict.
    [/^\/basics\/(memory\/)?$/, { href: "/discover/", t: "Discover the territory",
      s: ["Once you've found your footing here, the next move is to step back and take in a whole field at a glance — then pick one and we'll go in together.",
          "Got your footing? Step back and see a whole field at a glance, then pick one.",
          "Next: discover a field at a glance."] }],
    [/^\/(discover|infographics)(\/|$)/, { href: "/explore/", t: "Explore it for real",
      s: ["When one of those maps catches your eye, drop down into it and start poking — change things and watch the whole picture reason back at you.",
          "Caught your eye? Drop into it and poke — change something and watch it respond.",
          "Next: explore it hands-on."] }],
    [/^\/(explore|explorables)(\/|$)/, { href: "/build/", t: "Build the real thing",
      s: ["Once you can feel how something actually works, the natural next step is to turn that understanding into a tool that's properly your own.",
          "Feel how it works now? Turn that understanding into a tool of your own.",
          "Next: build your own."] }],
    [/^\/build(\/|$)/, { href: "/discover/", t: "Round the loop again",
      s: ["Here's the quiet part: the thing you just built makes something new worth noticing — so the loop starts over, one rung higher than before.",
          "What you built makes something new worth noticing — so the loop starts again, a rung higher.",
          "And the loop begins again."] }],
    [/^\/learn\/start/, { href: "/basics/", t: "Find your footing",
      s: ["Now you've dipped a toe in, come and get your footing properly — what this all is, and why it's taught the way it is.",
          "Dipped a toe in? Get your footing properly — what this is, and why.",
          "Next: the basics."] }],
    [/^\/(learn|notes)(\/|$)/, { href: "/discover/", t: "See a field at a glance",
      s: ["When you fancy a wider view, step back and take in a whole field at a glance, then pick the bit that pulls at you.",
          "Want a wider view? Take in a whole field at a glance, then pick one.",
          "Next: discover a field."] }],
    [/^\/products(\/|$)/, { href: "/community/", t: "Find your people",
      s: ["Things stick so much better with company — come and join lots of everyday people who are figuring all of this out together.",
          "Join everyday people figuring it out together.",
          "Join the community."] }],
    [/^\/community(\/|$)/, { href: "/basics/", t: "Keep getting better",
      s: ["Want to keep getting better at this? Wander back to the basics whenever you feel like it — there's no rush at all.",
          "Back to the basics whenever you fancy it.",
          "Back to the basics."] }]
  ];

  var next = null;
  for (var i = 0; i < MAP.length; i++) { if (MAP[i][0].test(p)) { next = MAP[i][1]; break; } }
  if (!next) return;

  var footer = document.querySelector("mgt-footer") || document.querySelector("footer");
  if (!footer) return;

  var el = document.createElement("aside");
  el.className = "journey-next";
  el.setAttribute("aria-label", "Suggested next step");
  el.innerHTML =
    '<div class="journey-inner"><span class="journey-kicker">Next step</span>' +
    '<a class="journey-link" href="' + next.href + '"><strong>' + next.t +
    ' →</strong><span class="journey-sub"></span></a></div>';
  footer.parentNode.insertBefore(el, footer);
  var sub = el.querySelector(".journey-sub");

  function tier() {
    var lv = parseInt(document.documentElement.getAttribute("data-level") || "3", 10) || 3;
    return lv <= 2 ? 0 : lv === 3 ? 1 : 2;
  }
  function paint() { sub.textContent = next.s[tier()]; }
  paint();

  // re-render the blurb when the reading-level setter changes data-level
  if (window.MutationObserver) {
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-level"] });
  }
})();
