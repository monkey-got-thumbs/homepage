/* basics-scrolly.js — the scrollytelling layer for the Basics one-pager (/basics/).
   Classic IIFE (site convention), CSP-safe, same-origin, no inline JS. Purely
   ADDITIVE: it only reads/writes wrapper-level attributes and injects decorative
   nodes — it never references a demo id, so it cannot disturb basics-essay.js, the
   ~15 live demos, or the reading-level engine. Loaded AFTER basics-essay.js. */
(function () {
  "use strict";

  var railNav = document.querySelector('.mgt-chapters');
  if (!railNav) return;                                    // inert on every other page

  var sections = Array.prototype.slice.call(document.querySelectorAll('.fx > section[id^="ch-"]'));
  var links = Array.prototype.slice.call(railNav.querySelectorAll('a[href^="#ch-"]'));
  var article = document.querySelector('.fx');
  if (!sections.length || !links.length) return;

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = function () { return reduceMQ.matches; };
  var pad2 = function (n) { return ('0' + n).slice(-2); };
  var labelOf = function (a) { var l = a.querySelector('.lab'); return l ? l.textContent : a.textContent; };

  var linkById = {};
  links.forEach(function (a) { linkById[(a.getAttribute('href') || '').slice(1)] = a; });

  /* ---------- inject decorative chrome (kept out of the HTML so JS-off stays clean) ---------- */
  var prog = document.createElement('div');
  prog.className = 'essay-progress';
  prog.setAttribute('aria-hidden', 'true');
  prog.innerHTML = '<i></i>';
  document.body.appendChild(prog);

  var counted = {};
  sections.forEach(function (sec, i) {
    var g = document.createElement('span');
    g.className = 'ch-ghost';
    g.setAttribute('aria-hidden', 'true');
    g.dataset.n = String(i + 1);
    g.textContent = reduce() ? pad2(i + 1) : '00';
    sec.insertBefore(g, sec.firstChild);
  });

  var pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'ch-pill';
  pill.setAttribute('aria-expanded', 'false');
  pill.textContent = '01 · ' + labelOf(links[0]) + ' · 1 / ' + sections.length;
  var rail = document.querySelector('.basics-rail');
  if (rail) rail.insertBefore(pill, rail.firstChild);
  pill.addEventListener('click', function () {
    var open = railNav.classList.toggle('open');
    pill.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  links.forEach(function (a) {
    a.addEventListener('animationend', function () { a.classList.remove('pulse'); });
  });

  railNav.setAttribute('data-ready', '');

  /* ---------- numeral count-up (runs once, when a chapter first becomes active) ---------- */
  function countUp(sec) {
    if (counted[sec.id]) return;
    counted[sec.id] = true;
    var g = sec.querySelector('.ch-ghost');
    if (!g) return;
    var target = parseInt(g.dataset.n, 10) || 0;
    if (reduce()) { g.textContent = pad2(target); return; }
    var start = null, dur = 460;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      g.textContent = pad2(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- scroll-spy ---------- */
  var visible = {};
  var activeId = null;

  function placeFill(a) {
    var y = a.offsetTop + a.offsetHeight / 2 - 11;         // 11 = half the 22px monkey / dot centring
    railNav.style.setProperty('--rail-fill', y + 'px');
    railNav.style.setProperty('--rail-monkey-y', y + 'px');
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    var idx = -1;
    sections.forEach(function (s, i) { if (s.id === id) idx = i; });
    links.forEach(function (a, i) {
      if (i === idx) { a.setAttribute('data-active', ''); a.setAttribute('aria-current', 'true'); }
      else { a.removeAttribute('data-active'); a.removeAttribute('aria-current'); }
      if (i < idx) a.setAttribute('data-passed', ''); else a.removeAttribute('data-passed');
    });
    var a = linkById[id];
    if (a) {
      placeFill(a);
      if (!reduce()) { a.classList.remove('pulse'); void a.offsetWidth; a.classList.add('pulse'); }
    }
    if (idx >= 0) {
      pill.textContent = pad2(idx + 1) + ' · ' + labelOf(links[idx]) + ' · ' + (idx + 1) + ' / ' + sections.length;
      countUp(sections[idx]);
    }
  }

  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) visible[en.target.id] = true; else delete visible[en.target.id];
      });
      for (var i = 0; i < sections.length; i++) {
        if (visible[sections[i].id]) { setActive(sections[i].id); return; }   // topmost visible wins
      }
      // none in the band → keep the last active
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
    setActive(sections[0].id);                              // light chapter 1 until the reader scrolls

    /* one-shot demo wake-up */
    var waker = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        waker.unobserve(en.target);
        if (!reduce()) en.target.classList.add('awake');
      });
    }, { threshold: 0.2 });
    Array.prototype.slice.call(document.querySelectorAll('.fx .fig')).forEach(function (f) { waker.observe(f); });
  } else {
    setActive(sections[0].id);                              // no IO: at least light chapter 1
  }

  /* ---------- top progress hairline ---------- */
  var ticking = false;
  function writeProgress() {
    ticking = false;
    if (!article) return;
    var r = article.getBoundingClientRect();
    var scrollable = r.height - window.innerHeight;
    var p = scrollable > 0 ? Math.min(1, Math.max(0, -r.top / scrollable)) : (r.top <= 0 ? 1 : 0);
    document.documentElement.style.setProperty('--essay-progress', p.toFixed(4));
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(writeProgress); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  writeProgress();

  /* ---------- click → move focus to the chapter (keyboard / AT parity) + collapse mobile list ---------- */
  railNav.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#ch-"]');
    if (!a) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (target) requestAnimationFrame(function () { target.focus({ preventScroll: true }); });
    railNav.classList.remove('open');
    pill.setAttribute('aria-expanded', 'false');
  });

  /* ---------- keep the fill/monkey correct across resizes ---------- */
  window.addEventListener('resize', function () {
    onScroll();
    if (activeId && linkById[activeId]) placeFill(linkById[activeId]);
  }, { passive: true });
})();
