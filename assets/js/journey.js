/* Journey continuity — a gentle "next step" handoff at the foot of each stage,
   so the nav's Start → Learn → Build → Products → Community is felt, not just
   labelled. CSP-safe (external). Injected above <mgt-footer>; no-ops elsewhere. */
(function () {
  "use strict";
  if (document.querySelector(".journey-next")) return;
  var p = location.pathname.replace(/index\.html$/, "");
  // don't intrude on the standalone product apps
  if (/\/(advisor|chatty|metron|writers-digest)(\/|$)/.test(p)) return;

  var MAP = [
    [/^\/learn\/start/,                    { href: "/learn/",     t: "Have a proper look around", s: "See everything there is to learn — and go at your own pace." }],
    [/^\/(learn|explorables|notes)(\/|$)/, { href: "/build/",     t: "Try making your own",       s: "Feeling braver? Build a little AI helper of your own." }],
    [/^\/build(\/|$)/,                     { href: "/products/",  t: "Or use one we made",        s: "Not in the mood to build? Meet our ready-made helpers." }],
    [/^\/products(\/|$)/,                  { href: "/community/", t: "Find your people",          s: "Join everyday people figuring it out together." }],
    [/^\/community(\/|$)/,                 { href: "/learn/",     t: "Keep getting better",       s: "Back to learning whenever you fancy it." }]
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
    '<div class="journey-inner">' +
      '<span class="journey-kicker">Next step</span>' +
      '<a class="journey-link" href="' + next.href + '">' +
        "<strong>" + next.t + " →</strong>" +
        "<span>" + next.s + "</span>" +
      "</a>" +
    "</div>";
  footer.parentNode.insertBefore(el, footer);
})();
