/* "Agents, in plain English" — an explorable essay. Two reusable interactives:
   a warm-up (a one-off ask going vague→specific) and the main build (assemble a
   real agent piece by piece and watch a customer reply go risky→reliable).
   CSP-safe (external). All AI replies are representative worked examples — never
   a live model call. */
(function () {
  "use strict";

  function builder(cfg) {
    var root = document.getElementById(cfg.root);
    if (!root) return;
    var q = function (s) { return root.querySelector(s); };
    var chips = q(".bx-chips"), asm = q(".bx-asm"), meter = q(".bx-meter"),
        out = q(".bx-out"), cap = q(".bx-cap"), callout = q(".bx-callout"),
        allBtn = q(".bx-all"), noneBtn = q(".bx-none");
    var active = {}, fired = false;
    var has = function (id) { return !!active[id]; };
    var count = function () { return cfg.ing.filter(function (g) { return active[g.id]; }).length; };
    var WSUM = cfg.ing.reduce(function (s, g) { return s + g.w; }, 0);

    function render() {
      chips.innerHTML = cfg.ing.map(function (g) {
        return '<button class="bx-chip' + (active[g.id] ? " on" : "") + '" data-id="' + g.id +
               '" aria-pressed="' + (!!active[g.id]) + '"><span class="bx-tick">' +
               (active[g.id] ? "✓" : "+") + "</span>" + g.label + "</button>";
      }).join("");

      var parts = ['<span class="bx-part base">' + cfg.base + "</span>"];
      cfg.ing.forEach(function (g) { if (active[g.id]) parts.push('<span class="bx-part">' + g.text + "</span>"); });
      asm.innerHTML = parts.join(cfg.joiner || " ");

      var u = cfg.base0;
      cfg.ing.forEach(function (g) { if (active[g.id]) u += (g.w / WSUM) * (99 - cfg.base0); });
      u = Math.min(99, Math.round(u));
      var col = u < 35 ? "var(--color-error)" : u < 70 ? "var(--color-warning)" : "var(--color-success)";
      meter.innerHTML = '<div class="bx-meter-lab">' + cfg.meterLabel + "</div>" +
        '<div class="bx-meter-bar"><i style="width:' + u + "%;background:" + col + '"></i></div>' +
        '<div class="bx-meter-val" style="color:' + col + '">' + u + "%</div>";

      out.innerHTML = cfg.generate(has, count());
      cap.innerHTML = cfg.caption(has, count());

      if (!fired && count() >= cfg.threshold) {
        fired = true; callout.hidden = false; callout.innerHTML = cfg.callout;
      }
    }

    chips.addEventListener("click", function (e) {
      var b = e.target.closest(".bx-chip"); if (!b) return;
      var id = b.getAttribute("data-id"); active[id] = !active[id]; render();
    });
    if (allBtn) allBtn.addEventListener("click", function () { cfg.ing.forEach(function (g) { active[g.id] = true; }); render(); });
    if (noneBtn) noneBtn.addEventListener("click", function () { active = {}; fired = false; callout.hidden = true; render(); });
    render();
  }

  /* ── A · the warm-up: a one-off ask, vague → specific (the birthday) ── */
  var BIRTHDAY = {
    root: "ask-demo", base: "Plan a birthday party.", base0: 14,
    meterLabel: "How useful the answer is", threshold: 3,
    ing: [
      { id: "who", label: "Who it's for", text: "It's for my 6-year-old.", w: 1.5 },
      { id: "specifics", label: "The specifics", text: "8 kids, a dinosaur theme, in our backyard.", w: 2.5 },
      { id: "limits", label: "The limits", text: "Under £150, and one child has a nut allergy.", w: 1.8 },
      { id: "format", label: "What you want back", text: "Give it as a checklist.", w: 1.2 }
    ],
    generate: function (has) {
      if (!has("who") && !has("specifics") && !has("limits") && !has("format"))
        return '<p class="bx-generic">Here are some general ideas for a birthday party: pick a theme, send out invitations, plan a few games, and get a cake. Good luck!</p>';
      var who = has("who") ? "your 6-year-old" : "the birthday";
      var lead = "Here's a plan for " + who + (has("specifics") ? ": a dinosaur party for 8 kids in your backyard" : "") + ".";
      var lim = has("limits") ? " Everything stays under £150 and is completely nut-free." : "";
      if (has("format")) {
        var items = has("specifics")
          ? ["Dinosaur decorations &amp; a few costumes", "Invitations for 8 kids, a week ahead", "2–3 dino games", "A nut-free dino cake", "Party bags with dino toys"]
          : ["A theme everyone loves", "Invitations, a week ahead", "A couple of games", "Food and a cake", "Party bags"];
        return "<p>" + lead + lim + '</p><p class="bx-list-h"><strong>Checklist</strong></p><ul class="bx-list">' +
               items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lead + lim + " " + (has("specifics") ? "I'd go with dino decorations, a couple of themed games, and a nut-free cake." : "Pick a theme, sort invitations, plan games and a cake.") + "</p>";
    },
    caption: function (has, n) {
      var ask = n === 0 ? "vague" : n < 3 ? "getting clearer" : "specific";
      var ans = n === 0 ? "generic and useless" : n < 3 ? "more tailored" : "genuinely useful";
      return "Your ask is <b>" + ask + "</b>, so the answer is <b>" + ans + "</b>. You changed <b>the ask</b>, never the AI.";
    },
    callout: '<span class="bx-lbl">⚡ there it is</span>The answer turned genuinely useful — and you never touched the AI. The fix was always the ask. An <b>agent</b> is just this same trick, written down once so you can reuse it.'
  };

  /* ── B · the main build: assemble a real agent, risky → reliable ── */
  var Q = "I bought these trainers 40 days ago and they fell apart — can I get a refund?";
  var AGENT = {
    root: "agent-builder", base: "[no instructions yet]", base0: 8, joiner: "<br>",
    meterLabel: "How reliable it is", threshold: 4,
    ing: [
      { id: "role", label: "① Who it is", text: "You are a support assistant for Northwind Shoes.", w: 1.0 },
      { id: "job", label: "② Its job", text: "Help customers with refund questions and starting a return.", w: 1.2 },
      { id: "facts", label: "③ The facts it must follow", text: "Policy: refunds within 30 days with proof of purchase; faulty items covered any time.", w: 2.6 },
      { id: "limits", label: "④ Its limits", text: "You can't approve refunds yourself; never promise money back.", w: 2.2 },
      { id: "unsure", label: "⑤ When it's unsure", text: "If it's out of scope or unclear, say so and offer a human.", w: 1.4 },
      { id: "tone", label: "⑥ Its tone", text: "Warm, plain English, short.", w: 0.8 },
      { id: "format", label: "⑦ The answer shape", text: "Reply in 2–3 sentences, then the next step.", w: 0.8 }
    ],
    generate: function (has, n) {
      var reply, flag;
      if (n === 0) {
        reply = "“Absolutely — I'll process your full refund right now! So sorry for the trouble.”";
        flag = '<p class="bx-flag">⚠ It just <b>made that up</b>. With no instructions it doesn\'t know your policy and has <b>promised money it can\'t give</b>.</p>';
      } else {
        var open = has("tone") ? "So sorry your trainers fell apart!" : "Regarding your refund.";
        var body = has("facts")
          ? " Because they're <b>faulty</b>, they're covered <b>any time</b> — even past the 30-day window — so this is eligible."
          : (has("job") ? " I can help with refund questions." : " Here's some general refund info.");
        var lim = has("limits")
          ? " I can't approve it myself, but I can show you how to start the return."
          : (has("facts") ? " I'll get that refund sorted for you straight away." : "");
        var step = has("format") ? "<br><b>Next:</b> reply “return” and I'll send the steps." : "";
        reply = "“" + open + body + lim + step + "”";
        var flags = [];
        if (!has("facts")) flags.push("No policy facts, so it can't apply the 40-day / faulty-item rule — it'll guess.");
        else if (!has("limits")) flags.push("No limits, so it just promised a refund it can't actually authorise.");
        else if (!has("unsure")) flags.push("No “if unsure” rule — on an out-of-scope message it'll bluff instead of handing off.");
        flag = flags.length
          ? '<p class="bx-flag">⚠ ' + flags[0] + "</p>"
          : '<p class="bx-good">✓ Accurate, safe, warm — and it knows the limits of what it can do.</p>';
      }
      return '<p class="bx-q"><span class="bx-who">Customer</span>' + Q + '</p><p class="bx-a"><span class="bx-who">Your agent</span>' + reply + "</p>" + flag;
    },
    caption: function (has, n) {
      var s = n === 0 ? "has no instructions, so it's <b>guessing — and dangerous</b>"
            : !has("facts") ? "doesn't know your policy yet, so it might get the rule <b>wrong</b>"
            : !has("limits") ? "knows the policy but could <b>over-promise</b> — it has no limits"
            : "knows the policy, its limits, and how to handle the unknown — it's <b>reliable</b>";
      return "Right now your agent " + s + ".";
    },
    callout: '<span class="bx-lbl">✦ that\'s an agent</span>You wrote a few plain-English lines and turned a reckless guesser into a careful, reliable worker — one that handles the tricky 40-days-but-faulty case correctly and never promises what it can\'t deliver. Same seven pieces work for <em>any</em> agent: who it is, its job, the facts, the limits, what to do when unsure, the tone, the shape.'
  };

  function init() { builder(BIRTHDAY); builder(AGENT); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
