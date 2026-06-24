/* "Build a better ask" — an explorable that teaches prompt/helper-writing.
   Toggle the ingredients of a good ask and watch a representative AI answer go
   from generic to genuinely useful — proving the problem was the ask, not the AI.
   CSP-safe (external). Representative answer (a worked example), not a live model. */
(function () {
  "use strict";
  var BASE = "Plan a birthday party.";
  var ING = [
    { id: "persona",   label: "Who AI should be", text: "You're an experienced kids'-party planner.", w: 1.0 },
    { id: "who",       label: "Who it's for",     text: "It's for my 6-year-old.", w: 1.5 },
    { id: "specifics", label: "The specifics",    text: "8 kids, a dinosaur theme, in our backyard.", w: 2.5 },
    { id: "limits",    label: "The limits",       text: "Keep it under £150, and one child has a nut allergy.", w: 1.8 },
    { id: "format",    label: "What you want back",text: "Give it to me as a checklist.", w: 1.2 }
  ];
  var WSUM = ING.reduce(function (s, g) { return s + g.w; }, 0);

  var active = {}, fired = false;
  var $ = function (id) { return document.getElementById(id); };
  var askText = $("askText"), chips = $("chips"), meter = $("meter"),
      answer = $("answer"), cap = $("askCaption"), callout = $("askCallout"),
      allBtn = $("askAll"), noneBtn = $("askNone");
  if (!askText) return;

  function count() { return ING.filter(function (g) { return active[g.id]; }).length; }

  function renderAnswer() {
    var has = function (id) { return !!active[id]; };
    if (count() === 0)
      return '<p class="ans-generic">Here are some general ideas for a birthday party: pick a theme, send out invitations, plan a few games, and get a cake. Good luck!</p>';
    var who = has("who") ? "your 6-year-old" : "the birthday";
    var lead = has("persona") ? "Right — as a kids'-party planner, here's a plan for " + who
                              : "Here's a plan for " + who;
    if (has("specifics")) lead += ": a dinosaur party for 8 kids in your backyard";
    lead += ".";
    var lim = has("limits") ? " Everything stays under £150 and is completely nut-free." : "";
    var out = "<p>" + lead + lim + "</p>";
    if (has("format")) {
      var items = has("specifics")
        ? ["Dinosaur decorations &amp; a couple of costumes", "Invitations for 8 kids, about a week ahead",
           "2–3 dino games (egg hunt, “pin the tail on the dino”)", "A nut-free dino cake + simple snacks",
           "Party bags with little dino toys"]
        : ["A theme everyone will love", "Invitations, about a week ahead", "A couple of games",
           "Food and a cake", "Party bags"];
      out += '<p class="ans-list-h"><strong>Checklist</strong></p><ul class="ans-list">' +
             items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
    } else {
      out += "<p>" + (has("specifics")
        ? "I'd go with dinosaur decorations, a couple of themed games, and a nut-free cake."
        : "Pick a theme, sort the invitations, plan a few games, and get a cake.") + "</p>";
    }
    return out;
  }

  function build() {
    chips.innerHTML = ING.map(function (g) {
      return '<button class="ask-chip' + (active[g.id] ? " on" : "") + '" data-id="' + g.id +
             '" aria-pressed="' + (!!active[g.id]) + '"><span class="ask-tick">' +
             (active[g.id] ? "✓" : "+") + "</span>" + g.label + "</button>";
    }).join("");

    var parts = ['<span class="ask-part base">' + BASE + "</span>"];
    ING.forEach(function (g) { if (active[g.id]) parts.push('<span class="ask-part">' + g.text + "</span>"); });
    askText.innerHTML = parts.join(" ");

    var u = 14;
    ING.forEach(function (g) { if (active[g.id]) u += (g.w / WSUM) * 85; });
    u = Math.min(99, Math.round(u));
    var col = u < 35 ? "var(--color-error)" : u < 70 ? "var(--color-warning)" : "var(--color-success)";
    meter.innerHTML = '<div class="ask-meter-lab">How useful the answer is</div>' +
      '<div class="ask-meter-bar"><i style="width:' + u + "%;background:" + col + '"></i></div>' +
      '<div class="ask-meter-val" style="color:' + col + '">' + u + "%</div>";

    answer.innerHTML = renderAnswer();

    var n = count();
    var ask = n === 0 ? "vague" : n < 3 ? "getting clearer" : "specific";
    var ans = n === 0 ? "generic and useless" : n < 3 ? "more tailored" : "genuinely useful";
    cap.innerHTML = "Your ask is <b>" + ask + "</b>, so the answer is <b>" + ans +
      "</b>. Notice what changed: <b>the ask</b>, never the AI.";

    if (!fired && n >= 3) {
      fired = true; callout.hidden = false;
      callout.innerHTML = '<span class="ask-lbl">⚡ there it is</span>' +
        "The answer just turned genuinely useful — and you <b>never touched the AI</b>. " +
        "That's the whole skill: tell it <b>who it's for</b>, <b>the specifics</b>, <b>the limits</b>, " +
        "and <b>what you want back</b>. Vague in, vague out — clear in, useful out. " +
        "<em>That</em> is building a helper.";
    }
  }

  chips.addEventListener("click", function (e) {
    var b = e.target.closest(".ask-chip"); if (!b) return;
    var id = b.getAttribute("data-id"); active[id] = !active[id]; build();
  });
  if (allBtn) allBtn.addEventListener("click", function () { ING.forEach(function (g) { active[g.id] = true; }); build(); });
  if (noneBtn) noneBtn.addEventListener("click", function () { active = {}; fired = false; callout.hidden = true; build(); });
  build();
})();
