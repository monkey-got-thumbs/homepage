/* THE LADDER — what is in reach, and what moves.
 *
 * The reader marks the jobs they could not do on their own today. That mark is the data: their own
 * line, not a study's. Then one lever adds something that will explain anything, as often as asked,
 * and the marked rows re-evaluate.
 *
 * The design rule this exists to satisfy: nothing here may tell the reader that AI can help them.
 * They mark their own limits, they pull the lever, they watch their own line move, and the
 * conclusion is theirs. There is no sentence anywhere that states it.
 *
 * Two rows never move. They sit in the list looking like all the others — the reader marks them
 * along with everything else, and then everything else shifts and those two stay put. They are not
 * questions, they are choices, and explaining does not touch a choice. Nothing says so; the rows
 * simply do not move, and the count at the bottom notices out loud.
 *
 * One row moves but comes back marked worth checking, because a version of this that showed only
 * upside would be lying by omission: in the BCG trial (Dell'Acqua et al. 2023) consultants working
 * outside the model's frontier were faster, more confident and measurably wronger — 60-70% correct
 * against 84.5% without it.
 *
 * No axis, no curve, no numbers. The ordering of the list is the only scale, and it is ordinal —
 * which is all anyone can honestly claim, since no measured scale of problem complexity exists.
 *
 * CSP-safe, classic IIFE, real buttons throughout so keyboard support is free. */
(function () {
  "use strict";

  var fig = document.getElementById("reach-ladder");
  if (!fig) return;

  /* outcome when the lever is on:
     "already" — most people can already do it, so there is nothing to move
     "moves"   — crosses into reach
     "check"   — crosses, but you would want to check it
     "never"   — a choice, not a question */
  var JOBS = [
    { text: "Add up a column of numbers", out: "already" },
    { text: "Make a chart from a spreadsheet", out: "moves" },
    { text: "Write a formula that looks something up in another sheet", out: "moves" },
    { text: "Tidy 500 addresses that were all typed differently", out: "moves" },
    { text: "Pull the totals out of 200 PDF invoices", out: "moves" },
    { text: "Have something email you a summary every Monday", out: "moves" },
    { text: "Work out why your busiest month lost money", out: "check" },
    { text: "Decide whether to take the bigger contract or keep the smaller client", out: "never" },
    { text: "Decide who to promote", out: "never" }
  ];

  var LABEL = {
    moves: "now in reach",
    check: "in reach — worth checking",
    never: "",
    already: ""
  };

  var marked = {};       /* index -> true, meaning "not me, today" */
  var lever = false;

  var rows = fig.querySelectorAll("[data-lad-row]");
  var leverBtn = fig.querySelector("[data-lad-lever]");
  var countEl = fig.querySelector("[data-lad-count]");
  var statusEl = fig.querySelector("[data-lad-status]");

  function outcomeFor(i) {
    if (!marked[i]) return "unmarked";
    if (!lever) return "out";
    return JOBS[i].out === "already" ? "moves" : JOBS[i].out;
  }

  function render() {
    var moved = 0, stuck = 0, totalMarked = 0;

    Array.prototype.forEach.call(rows, function (row) {
      var i = +row.getAttribute("data-lad-row");
      var state = outcomeFor(i);
      var stateEl = row.querySelector("[data-lad-state]");

      row.setAttribute("aria-pressed", marked[i] ? "true" : "false");
      row.setAttribute("data-state", state);

      if (marked[i]) totalMarked++;
      if (state === "moves" || state === "check") moved++;
      if (state === "never") stuck++;

      if (stateEl) {
        stateEl.textContent = state === "out" ? "not me, today"
          : state === "moves" ? LABEL.moves
          : state === "check" ? LABEL.check
          : "";
      }
    });

    fig.setAttribute("data-lad-on", lever ? "true" : "false");
    if (leverBtn) leverBtn.setAttribute("aria-pressed", lever ? "true" : "false");

    var msg = "";
    if (!totalMarked) {
      msg = "";
    } else if (!lever) {
      msg = totalMarked === 1 ? "One out of reach." : totalMarked + " out of reach.";
    } else {
      msg = moved + (moved === 1 ? " moved" : " moved");
      if (stuck) msg += " · " + stuck + (stuck === 1 ? " didn’t" : " didn’t");
    }
    if (countEl) countEl.textContent = msg;

    if (statusEl) {
      statusEl.textContent = !totalMarked
        ? "Nothing marked yet."
        : !lever
          ? totalMarked + " marked out of reach."
          : moved + " of your " + totalMarked + " moved into reach. " +
            (stuck ? stuck + " did not move." : "");
    }
  }

  Array.prototype.forEach.call(rows, function (row) {
    row.addEventListener("click", function () {
      var i = +row.getAttribute("data-lad-row");
      if (marked[i]) delete marked[i]; else marked[i] = true;
      render();
    });
  });

  if (leverBtn) leverBtn.addEventListener("click", function () {
    lever = !lever;
    render();
  });

  render();
})();
