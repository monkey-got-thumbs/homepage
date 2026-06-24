/* Copy-to-clipboard for [data-target] buttons next to a <pre>. CSP-safe (external). */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".copy-btn");
    if (!b) return;
    var pre = document.getElementById(b.getAttribute("data-target"));
    if (!pre || !navigator.clipboard) return;
    navigator.clipboard.writeText(pre.innerText).then(function () {
      var prev = b.textContent;
      b.textContent = "Copied ✓";
      setTimeout(function () { b.textContent = prev; }, 1600);
    });
  });
})();
