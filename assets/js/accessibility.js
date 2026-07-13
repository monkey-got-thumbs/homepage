/* Accessibility engine — panel UI, colour-vision filters, reading-level content swap.
   CSP-safe (external, same-origin). Settings persist in localStorage; a11y-init.js
   applies them before paint, this file builds the controls and the live behaviour. */
(function () {
  "use strict";
  var H = document.documentElement;
  var LS = function (k) { return 'a11y.' + k; };
  var state = {
    scheme: get('scheme', 'dark'),
    cvd: get('cvd', 'none'),
    sim: get('sim', 'off'),
    level: parseInt(get('level', '3'), 10) || 3,
    dir: get('dir', 'ltr')
  };
  function get(k, d) { try { var v = localStorage.getItem(LS(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save() { try { for (var k in state) localStorage.setItem(LS(k), state[k]); } catch (e) {} }

  /* ---- colour-vision simulation filters (Brettel/standard matrices) ---- */
  var svg = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<filter id="a11y-sim-protan"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter>' +
    '<filter id="a11y-sim-deutan"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter>' +
    '<filter id="a11y-sim-tritan"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter>' +
    '<filter id="a11y-sim-achroma"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"/></filter>' +
    '</defs></svg>';

  /* ---- panel markup ---- */
  var panel =
    '<button class="a11y-fab" id="a11yFab" aria-label="Settings" aria-expanded="false" aria-controls="a11yPanel"><img class="a11y-fab-face" src="/favicon.png" alt="" width="30" height="30" decoding="async"></button>' +
    '<div class="a11y-panel" id="a11yPanel" role="dialog" aria-label="Accessibility settings">' +
      '<h3>Colour scheme</h3><div class="a11y-row" data-group="scheme">' +
        '<button class="a11y-opt" data-v="dark"><span class="dot" style="background:#0E0B1A"></span>Dark</button>' +
        '<button class="a11y-opt" data-v="light"><span class="dot" style="background:#fff"></span>Light</button>' +
        '<button class="a11y-opt" data-v="contrast"><span class="dot" style="background:#000;border-color:#ff0"></span>High contrast</button>' +
        '<button class="a11y-opt" data-v="sepia"><span class="dot" style="background:#f4ecd8"></span>Sepia</button>' +
      '</div>' +
      '<h3>Colour vision</h3><div class="a11y-row" data-group="cvd">' +
        '<button class="a11y-opt" data-v="none">Default colours</button>' +
        '<button class="a11y-opt" data-v="safe">Colour-blind-safe</button>' +
      '</div>' +
      '<h3>Simulate my vision <span class="small">(check it works for you)</span></h3><div class="a11y-row" data-group="sim">' +
        '<button class="a11y-opt" data-v="off">Off</button>' +
        '<button class="a11y-opt" data-v="protan">Protanopia</button>' +
        '<button class="a11y-opt" data-v="deutan">Deuteranopia</button>' +
        '<button class="a11y-opt" data-v="tritan">Tritanopia</button>' +
        '<button class="a11y-opt" data-v="achroma">No colour</button>' +
      '</div>' +
      '<h3>Reading level <span class="small">(slide the monkey, or pick a level)</span></h3>' +
      '<div class="a11y-slider"><mgt-reading-slider></mgt-reading-slider></div>' +
      '<div class="a11y-row" data-group="level">' +
        '<button class="a11y-opt" data-v="1">Simplest</button>' +
        '<button class="a11y-opt" data-v="2">Simpler</button>' +
        '<button class="a11y-opt" data-v="3">Default</button>' +
        '<button class="a11y-opt" data-v="4">Denser</button>' +
        '<button class="a11y-opt" data-v="5">Densest</button>' +
      '</div>' +
      '<h3>Direction</h3><div class="a11y-row" data-group="dir">' +
        '<button class="a11y-opt" data-v="ltr">LTR</button>' +
        '<button class="a11y-opt" data-v="rtl">RTL</button>' +
      '</div>' +
      '<div class="a11y-foot"><button id="a11yReset">Reset</button></div>' +
    '</div>';

  /* ---- "punch it" nudge — a chunky title-font arrow pointing at the settings button ---- */
  var nudge =
    '<div class="a11y-nudge" id="a11yNudge" aria-hidden="true">' +
      '<svg viewBox="0 0 160 285" width="82" height="146" role="presentation">' +
        '<path id="mgtPunchSpine" style="fill:none" d="M 79,184 L 83,48"/>' +
        '<path d="M 46,28 C 58,14 106,12 120,26 C 108,92 96,150 96,198 L 132,194 L 76,278 L 20,194 L 60,198 C 48,150 36,92 46,28 Z" ' +
          'style="fill:var(--color-accent);stroke:var(--color-bg);stroke-width:8;stroke-linejoin:round;stroke-linecap:round"/>' +
        '<text style="fill:var(--color-bg);font-family:var(--font-display,sans-serif);font-size:39px;letter-spacing:0.5px;dominant-baseline:central;paint-order:stroke;stroke:var(--color-bg);stroke-width:1.6px;stroke-linejoin:round">' +
          '<textPath href="#mgtPunchSpine" startOffset="50%" text-anchor="middle">PUNCH</textPath>' +
        '</text>' +
      '</svg>' +
    '</div>';

  function mount() {
    var holder = document.createElement('div');
    holder.innerHTML = svg + panel + nudge;
    while (holder.firstChild) document.body.appendChild(holder.firstChild);
    // The reading-level slider now lives in this panel; pull in its module so the
    // custom element upgrades (it self-registers on load). Harmless if already loaded.
    import('/components/core/mgt-reading-slider.js').catch(function () {});
    wire();
    apply();
  }

  function apply() {
    H.dataset.scheme = state.scheme;
    H.dataset.cvd = (state.cvd === 'safe') ? 'safe' : 'none';
    if (state.sim && state.sim !== 'off') H.dataset.sim = state.sim; else H.removeAttribute('data-sim');
    H.dataset.level = state.level;
    H.setAttribute('dir', state.dir);
    // reflect button states
    document.querySelectorAll('.a11y-panel [data-group]').forEach(function (g) {
      var key = g.getAttribute('data-group');
      var cur = (key === 'dir') ? state.dir : state[key];
      g.querySelectorAll('.a11y-opt').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === cur));
      });
    });
    save();
    swapContent();
  }
  function set(k, v) { state[k] = v; apply(); }

  function wire() {
    var fab = document.getElementById('a11yFab'), pan = document.getElementById('a11yPanel');
    var nudgeEl = document.getElementById('a11yNudge');
    try { if (nudgeEl && localStorage.getItem('a11y.nudged')) nudgeEl.classList.add('gone'); } catch (e) {}
    fab.addEventListener('click', function () {
      var open = pan.classList.toggle('open'); fab.setAttribute('aria-expanded', String(open));
      if (nudgeEl) nudgeEl.classList.add('gone');   // they found it — retire the nudge
      try { localStorage.setItem('a11y.nudged', '1'); } catch (e) {}
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { pan.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); } });
    document.querySelectorAll('.a11y-panel [data-group]').forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('.a11y-opt'); if (!b) return;
        set(g.getAttribute('data-group'), b.getAttribute('data-v'));
      });
    });
    document.getElementById('a11yReset').addEventListener('click', function () {
      state.scheme = 'dark'; state.cvd = 'none'; state.sim = 'off'; state.level = 3; state.dir = 'ltr'; apply();
    });
  }

  /* ---- reading-level content swap (pre-generated per page; graceful if absent) ---- */
  var CONTENT = null, CONTENT_TRIED = false;
  function pageSlug() {
    var p = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
    if (p === '' ) return 'home';
    return p.replace(/^\//, '').replace(/\//g, '-') || 'home';
  }
  function swapContent() {
    var blocks = document.querySelectorAll('[data-a11y]');
    if (!blocks.length) return;                       // page has no managed prose yet
    if (CONTENT) return paint(blocks);
    if (CONTENT_TRIED) return;
    CONTENT_TRIED = true;
    fetch('/assets/a11y-content/' + pageSlug() + '.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { CONTENT = j || {}; paint(blocks); }).catch(function () { CONTENT = {}; });
  }
  function paint(blocks) {
    if (!CONTENT) return;
    blocks.forEach(function (el) {
      var key = el.getAttribute('data-a11y'); var variants = CONTENT[key];
      if (variants && variants[state.level - 1] != null) el.innerHTML = variants[state.level - 1];
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  window.__A11Y = { state: state, set: set };
})();
