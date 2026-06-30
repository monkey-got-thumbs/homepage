/* sounding-board.js — a live "think with it" exchange on the site LLM endpoint
   (/api/llm → Amazon Nova 2 Lite). It's a partner, not an oracle: the system
   prompt steers it to ask questions and offer angles, never to decide for you.
   Model output is rendered as text (never HTML). CSP-safe (external). */
(function () {
  "use strict";
  var form = document.getElementById("sbForm");
  if (!form) return;
  var log = document.getElementById("sbLog");
  var input = document.getElementById("sbInput");
  var send = document.getElementById("sbSend");
  var status = document.getElementById("sbStatus");
  var reset = document.getElementById("sbReset");
  var empty = document.getElementById("sbEmpty");
  var chips = document.getElementById("sbChips");

  var ENDPOINT = "/api/llm";
  var SYSTEM = [
    "You are a thinking partner — a sounding board, not an answer machine. The person is working something out: an idea, a plan, a piece of writing, or a decision. Your job is to help THEM think, not to think for them.",
    "How to respond:",
    "- Reflect back, briefly, what you heard — so they feel understood.",
    "- Lead with one or two good questions that would sharpen it.",
    "- Offer at most one angle they might not have considered, briefly.",
    "- Never decide for them or hand down a verdict; the taste and the call stay theirs.",
    "- Be warm, plain, and concise: 2 to 4 short sentences, no jargon, no bulleted lectures.",
    "- If they share a draft, react honestly and specifically (what lands, what's unclear), then ask what they want to do with it."
  ].join("\n");

  var messages = []; // {role:'user'|'assistant', content}
  var busy = false;

  var ERR = {
    rate_limited: "That's today's free limit reached — come back tomorrow, or read on for now.",
    paused: "The sounding board is resting (busy day). Try again a little later.",
    forbidden: "The live sounding board runs on the published site.",
    too_large: "That's a bit long — trim it and try again.",
    llm_error: "Small hiccup answering that — give it another go.",
    no_messages: "Type something first.",
    bad_json: "Something went wrong sending that — try again."
  };

  function bubble(role, text) {
    var el = document.createElement("div");
    el.className = "sb-msg " + (role === "user" ? "you" : "it");
    var who = document.createElement("span");
    who.className = "who";
    who.textContent = role === "user" ? "You" : "Sounding board";
    var body = document.createElement("span");
    body.textContent = String(text == null ? "" : text);
    el.appendChild(who);
    el.appendChild(body);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return body;
  }

  function setBusy(b) {
    busy = b;
    send.disabled = b;
    send.textContent = b ? "Thinking…" : "Send →";
  }
  function fail(msg) { status.textContent = msg; status.classList.add("err"); }
  function clearStatus() { status.textContent = ""; status.classList.remove("err"); }

  async function ask() {
    if (busy) return;
    var text = (input.value || "").trim();
    if (!text) return;
    if (empty) { empty.remove(); empty = null; }
    if (chips) chips.style.display = "none";
    clearStatus();
    messages.push({ role: "user", content: text });
    bubble("user", text);
    input.value = "";
    reset.hidden = false;
    setBusy(true);
    var target = bubble("assistant", "…");
    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ system: SYSTEM, messages: messages, max_tokens: 400, temperature: 0.6 })
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok || data.error) {
        var code = (data && data.error) || (res.status === 404 ? "forbidden" : "llm_error");
        target.parentNode.remove();
        messages.pop(); // drop the unanswered turn so the thread stays clean
        fail(ERR[code] || ERR.llm_error);
        return;
      }
      var reply = (data.text || "").trim() || "(no reply — try rephrasing)";
      target.textContent = reply;
      messages.push({ role: "assistant", content: reply });
      log.scrollTop = log.scrollHeight;
    } catch (e) {
      target.parentNode.remove();
      messages.pop();
      fail("Couldn't reach the model just now — check your connection and try again.");
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); ask(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
  });
  if (chips) chips.addEventListener("click", function (e) {
    var b = e.target.closest(".sb-chip");
    if (!b) return;
    input.value = b.getAttribute("data-seed") || "";
    ask();
  });
  reset.addEventListener("click", function () {
    messages = [];
    log.innerHTML = "";
    var p = document.createElement("p");
    p.className = "sb-empty";
    p.textContent = "Fresh start — what's on your mind?";
    log.appendChild(p);
    empty = p;
    reset.hidden = true;
    clearStatus();
    if (chips) chips.style.display = "";
    input.focus();
  });
})();
