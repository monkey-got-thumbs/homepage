/* Applies saved accessibility prefs to <html> BEFORE first paint (no flash).
   Loaded synchronously in <head>; intentionally tiny. */
(function () {
  try {
    var h = document.documentElement;
    var g = function (k, d) { var v = localStorage.getItem('a11y.' + k); return v == null ? d : v; };
    h.dataset.scheme = g('scheme', 'dark');
    h.dataset.cvd = (g('cvd', 'none') === 'safe') ? 'safe' : 'none';
    var sim = g('sim', 'off'); if (sim && sim !== 'off') h.dataset.sim = sim; else h.removeAttribute('data-sim');
    h.dataset.level = g('level', '3');
    h.setAttribute('dir', g('dir', 'ltr'));
  } catch (e) { /* storage blocked — keep defaults */ }
})();
