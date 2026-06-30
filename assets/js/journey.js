/* Journey continuity — a gentle "next step" handoff at the foot of each stage,
   so the nav's Start → Learn → Build → Products → Community is felt, not just
   labelled. CSP-safe (external). Injected above <mgt-footer>; no-ops elsewhere.
   The blurb adapts to the reading-level setter (data-level on <html>). */
(function () {
  "use strict";
  if (document.querySelector(".journey-next") || document.querySelector(".path-next")) return;
  var p = location.pathname.replace(/index\.html$/, "");
  if (/\/(advisor|chatty|metron|writers-digest)(\/|$)/.test(p)) return;

  // s = [low (frustrated/verbose), mid (default), high (patronising/terse)]
  var MAP = [
    [/^\/learn\/start/, { href: "/learn/", t: "Have a proper look around",
      s: ["Now that you've dipped a toe in, come and have a proper look at everything there is to learn — at your own gentle pace.",
          "See everything there is to learn — and go at your own pace.",
          "Browse everything to learn."] }],
    [/^\/(learn|explorables|notes)(\/|$)/, { href: "/build/", t: "Try making your own",
      s: ["Feeling a bit braver now? Have a go at building a little AI agent of your very own — we'll walk you through every step.",
          "Feeling braver? Build a little AI agent of your own.",
          "Build your own agent."] }],
    [/^\/build(\/|$)/, { href: "/products/", t: "Or use one we made",
      s: ["Don't fancy building it all yourself? That's completely fine — come and meet the ready-made agents we've already built for you.",
          "Not in the mood to build? Meet our ready-made agents.",
          "Or use a ready-made agent."] }],
    [/^\/products(\/|$)/, { href: "/community/", t: "Find your people",
      s: ["Things stick so much better with company — come and join lots of everyday people who are figuring all of this out together.",
          "Join everyday people figuring it out together.",
          "Join the community."] }],
    [/^\/community(\/|$)/, { href: "/learn/", t: "Keep getting better",
      s: ["Want to keep getting better at this? Wander back to the learning whenever you feel like it — there's no rush at all.",
          "Back to learning whenever you fancy it.",
          "Back to learning."] }]
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
