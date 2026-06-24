/* "The coffee problem" explorable — meta-cognition, made tangible.
 *
 * Two continuous controls: how SPECIFIC your ask is, and how much CONTEXT you
 * gave. As you drag, a representative AI RESPONSE rewrites itself live — from a
 * generic wrong guess to a precise, useful answer — and a "what it still had to
 * guess" panel visibly shrinks. Reactive prose names the move you just made
 * ("you thought about your own thinking"), and a payoff fires once the answer
 * becomes genuinely good.
 *
 * CSP-safe: external module, no inline JS, all wiring via addEventListener.
 * Progressive enhancement: if JS never runs, the static markup already shows
 * the vague case. The AI reply is a representative worked example, never a live
 * model call.
 */
(function () {
  "use strict";

  var root = document.getElementById("coffee-dial");
  if (!root) return;

  var spec = root.querySelector('[data-spec]');     // specificity slider 0..100
  var ctx = root.querySelector('[data-ctx]');       // context slider 0..100
  if (!spec || !ctx) return;

  var $ = function (sel) { return root.querySelector(sel); };
  var askEl = $('[data-ask]');           // the evolving ask text
  var replyEl = $('[data-reply]');        // the evolving AI response
  var faceEl = $('[data-face]');          // representative reaction glyph
  var guessList = $('[data-guess-list]'); // <ul> of what it still had to guess
  var guessHd = $('[data-guess-head]');   // heading above the guess list
  var meterFill = $('[data-meter-fill]'); // usefulness bar
  var meterWrap = $('[data-meter]');      // progressbar element
  var meterVal = $('[data-meter-val]');   // numeric %
  var moveEl = $('[data-move]');          // reactive prose: the move you made
  var payoff = $('[data-payoff]');        // unmissable "there it is" callout
  var specOut = $('[data-spec-out]');     // live label for specificity
  var ctxOut = $('[data-ctx-out]');       // live label for context

  /* ── The ask, written in layers. Each layer is unlocked by specificity. ──
     We grow the sentence the way a person sharpens it in their head: from a
     bare noun to a precise, contextualised request. */
  function buildAsk(s, c) {
    if (s < 12) return "coffee";
    var ask = "get me a coffee";
    if (s >= 32) ask = "get me a coffee, now";
    if (s >= 52) ask = "get me a coffee from the café";
    if (s >= 72) ask = "get me a flat white from the café next door";
    if (s >= 90) ask = "get me a flat white, oat milk, from the café next door";
    // Context is the unspoken part you choose to say out loud.
    var tail = [];
    if (c >= 40) tail.push("I'm in back-to-backs till noon");
    if (c >= 72) tail.push("here's £5");
    if (tail.length) ask += " — " + tail.join(", ");
    return ask;
  }

  /* ── The representative AI response. It changes shape, not just wording, as
     the ask gets clearer — the whole point is that the *output* improves. ── */
  function buildReply(s, c) {
    // Almost nothing to go on: a keen agent fills the void with something absurd.
    if (s < 12) {
      return {
        face: "😵",
        html: "“On it. I’ve put a deposit on a <b>coffee plantation in Colombia</b> — 220 hectares, great soil. Shall I arrange the flight?”"
      };
    }
    // A verb but no place, no kind, no when.
    if (s < 32) {
      return {
        face: "😬",
        html: "“Sure. I’ve ordered <b>100 cups</b> from a wholesaler — best price by the crate. They’ll arrive <b>next month</b>. Want me to set up a standing order?”"
      };
    }
    // "Now" lands, but it doesn't know where from.
    if (s < 52) {
      return {
        face: "😅",
        html: "“Right away! I grabbed the <b>nearest cup I could find</b> — it was on a stranger’s desk, but it’s coffee and it’s hot. Here you go.”"
      };
    }
    // A café, but which? What kind? Cold by the time it's back.
    if (s < 72) {
      return {
        face: "🤔",
        html: "“Got one from a café. I went to the <b>good</b> one across town, so it took a while — it’s a filter coffee, and it’s gone a little cold. That OK?”"
      };
    }
    // Precise drink, precise place. Genuinely useful.
    var drink = (s >= 90) ? "n <b>oat-milk flat white</b>" : " <b>flat white</b>";
    var fast = (c >= 40) ? " I knew you were in back-to-backs, so I went <b>straight there and back</b> — it’s still hot." : "";
    var change = (c >= 72) ? " <b>Change is on your desk.</b>" : "";
    return {
      face: (s >= 90 && c >= 72) ? "😎" : "😄",
      html: "“Here — a" + drink + " from the café next door." + fast + change + "”"
    };
  }

  /* ── What the AI STILL had to guess. This list shrinks as you add clarity. ──
     Each gap is something a person would silently assume — meta-cognition is
     noticing them and choosing which to say. */
  function openGuesses(s, c) {
    var g = [];
    if (s < 32) g.push("Did you mean a <em>drink</em>, or beans, or a whole plantation?");
    if (s < 90) g.push("What kind of coffee — flat white? filter? oat milk?");
    if (s < 52) g.push("From <em>where</em> — a café, the kitchen, anywhere?");
    if (s < 32) g.push("<em>When</em> do you need it — now, or next month?");
    if (c < 40) g.push("How much of a rush are you in?");
    if (c < 72) g.push("Are you paying — and how?");
    return g;
  }

  /* Usefulness: specificity carries most of the weight, context tops it off.
     Bounded so it never quite hits 100 (there's always *something* unsaid). */
  function usefulness(s, c) {
    var u = 6 + (s / 100) * 78 + (c / 100) * 14;
    return Math.max(4, Math.min(99, Math.round(u)));
  }

  function specWord(s) {
    if (s < 12) return "barely a hint";
    if (s < 32) return "a vague gesture";
    if (s < 52) return "getting clearer";
    if (s < 72) return "fairly specific";
    if (s < 90) return "precise";
    return "exact";
  }
  function ctxWord(c) {
    if (c < 40) return "none of your situation";
    if (c < 72) return "a little of your situation";
    return "the situation that matters";
  }

  /* Reactive prose that NAMES the meta-cognitive move the reader just made. */
  function moveLine(s, c, prevS, prevC) {
    // Prefer to comment on whichever control just moved.
    var bumpedSpec = prevS != null && s !== prevS;
    var bumpedCtx = prevC != null && c !== prevC;

    if (s < 12 && c < 40)
      return "Right now you’ve said almost nothing — and a keen agent fills every gap <em>itself</em>. Drag a slider and watch the guessing shrink.";

    if (bumpedCtx && !bumpedSpec && c >= 40)
      return "You just added <strong>context the AI couldn’t see</strong> — your day, your budget. You noticed what <em>you</em> were quietly assuming it knew. <strong>That noticing is meta-cognition.</strong>";

    if (s >= 72 && c >= 72)
      return "You named the drink, the place, your rush, the money — you said the quiet part out loud. <strong>You just thought about your own thinking. That is the whole skill.</strong>";

    if (s >= 52)
      return "Each notch, you asked yourself <em>“what am I still leaving unsaid?”</em> — and answered it. <strong>That question is meta-cognition in one move.</strong>";

    if (s >= 32)
      return "You’re pinning down what you actually meant — a verb, a moment, soon a place. <strong>Watch your own thinking, and you lead the AI instead of being led.</strong>";

    return "Adding a word made the AI less wrong. You’re not training the model — you’re <strong>clarifying what you wanted</strong>. Keep dragging.";
  }

  var firedPayoff = false;
  var prevS = null, prevC = null;

  function render() {
    var s = +spec.value;
    var c = +ctx.value;

    var ask = buildAsk(s, c);
    var reply = buildReply(s, c);
    var gaps = openGuesses(s, c);
    var u = usefulness(s, c);

    if (askEl) askEl.textContent = "“" + ask + "”";
    if (replyEl) replyEl.innerHTML = reply.html;
    if (faceEl) faceEl.textContent = reply.face;

    // The shrinking "still had to guess" panel.
    if (guessList) {
      if (gaps.length === 0) {
        guessList.innerHTML = '<li class="cd-guess-none">Nothing left worth guessing. It did what you <em>meant</em>.</li>';
      } else {
        guessList.innerHTML = gaps.map(function (g) {
          return '<li>' + g + '</li>';
        }).join("");
      }
    }
    if (guessHd) {
      guessHd.textContent = gaps.length === 0
        ? "What the AI had to guess"
        : "What the AI still has to guess (" + gaps.length + ")";
    }

    // Usefulness meter, coloured by site tokens.
    var col = u < 35 ? "var(--color-error)" : u < 70 ? "var(--color-warning)" : "var(--color-success)";
    if (meterFill) {
      meterFill.style.width = u + "%";
      meterFill.style.background = col;
    }
    if (meterVal) {
      meterVal.textContent = u + "%";
      meterVal.style.color = col;
    }
    if (meterWrap) meterWrap.setAttribute("aria-valuenow", String(u));

    // Live slider labels.
    if (specOut) specOut.textContent = specWord(s);
    if (ctxOut) ctxOut.textContent = ctxWord(c);

    // Reactive prose naming the move.
    if (moveEl) moveEl.innerHTML = moveLine(s, c, prevS, prevC);

    // The payoff: fires once the answer is genuinely good.
    var good = s >= 72 && c >= 40 && gaps.length <= 1;
    if (payoff) {
      if (good && !firedPayoff) {
        firedPayoff = true;
        payoff.hidden = false;
      }
    }

    root.setAttribute("data-good", good ? "true" : "false");
    prevS = s; prevC = c;
  }

  spec.addEventListener("input", render);
  ctx.addEventListener("input", render);
  render();
})();
