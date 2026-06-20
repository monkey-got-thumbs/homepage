/**
 * Monkey Got Thumbs — Tracking & Analytics
 *
 * GA4, Meta Pixel, UTM capture, conversion events, scroll depth.
 * Replace placeholder IDs with real ones when accounts are ready.
 */
(function () {
    'use strict';

    // ── Configuration ───────────────────────────────────────────────
    var GA4_ID = 'G-XXXXXXXXXX';           // TODO: replace with real GA4 measurement ID
    var META_PIXEL_ID = 'XXXXXXXXXX';      // TODO: replace with real Meta Pixel ID
    var SIGNUP_ENDPOINT = 'https://mi77kvcp7baws2u263gwowzr6i0msooy.lambda-url.us-east-1.on.aws/';
    // Agent Builder Advisor. Empty until the Bedrock-backed Lambda is deployed —
    // the advisor page runs in preview mode (teaching example) until this is set.
    var ADVISOR_ENDPOINT = '';            // TODO: set to the advisor Lambda function URL after `terraform apply`
    var TURNSTILE_SITE_KEY = '';          // TODO: set to your Cloudflare Turnstile site key

    // ── GA4 ─────────────────────────────────────────────────────────
    if (GA4_ID !== 'G-XXXXXXXXXX') {
        var gs = document.createElement('script');
        gs.async = true;
        gs.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
        document.head.appendChild(gs);

        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', GA4_ID, { anonymize_ip: true });
    }

    // ── Meta Pixel ──────────────────────────────────────────────────
    if (META_PIXEL_ID !== 'XXXXXXXXXX') {
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return; n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
            n.queue = []; t = b.createElement(e); t.async = !0;
            t.src = v; s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
        }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        window.fbq('init', META_PIXEL_ID);
        window.fbq('track', 'PageView');
    }

    // ── UTM Capture ─────────────────────────────────────────────────
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

    function captureUTM() {
        try {
            var params = new URLSearchParams(window.location.search);
            UTM_KEYS.forEach(function (key) {
                var val = params.get(key);
                if (val) sessionStorage.setItem(key, val);
            });
        } catch (e) { /* sessionStorage not available */ }
    }

    function getUTM() {
        var utm = {};
        try {
            UTM_KEYS.forEach(function (key) {
                utm[key] = sessionStorage.getItem(key) || '';
            });
        } catch (e) { /* ignore */ }
        return utm;
    }

    captureUTM();

    // ── Conversion Events ───────────────────────────────────────────
    function trackEvent(name, params) {
        if (window.gtag) window.gtag('event', name, params || {});
        if (window.fbq) window.fbq('trackCustom', name, params || {});
    }

    // Track CTA clicks
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn, [data-track]');
        if (!btn) return;
        trackEvent('cta_click', {
            text: btn.textContent.trim().substring(0, 50),
            href: btn.getAttribute('href') || '',
            page: window.location.pathname
        });
    });

    // Track scroll depth (25%, 50%, 75%, 100%)
    var scrollMarks = {};
    var scrollTicking = false;

    function checkScroll() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;

        var pct = Math.round((scrollTop / docHeight) * 100);
        [25, 50, 75, 100].forEach(function (mark) {
            if (pct >= mark && !scrollMarks[mark]) {
                scrollMarks[mark] = true;
                trackEvent('scroll_depth', { depth: mark, page: window.location.pathname });
            }
        });
        scrollTicking = false;
    }

    window.addEventListener('scroll', function () {
        if (!scrollTicking) {
            requestAnimationFrame(checkScroll);
            scrollTicking = true;
        }
    }, { passive: true });

    // ── Newsletter Signup ───────────────────────────────────────────
    function submitSignup(email) {
        var utm = getUTM();
        return fetch(SIGNUP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                page: window.location.pathname,
                utm_source: utm.utm_source,
                utm_medium: utm.utm_medium,
                utm_campaign: utm.utm_campaign,
                utm_term: utm.utm_term,
                utm_content: utm.utm_content
            })
        }).then(function (r) { return r.json(); });
    }

    // ── Public API ──────────────────────────────────────────────────
    window.MGT_TRACKING = {
        trackEvent: trackEvent,
        submitSignup: submitSignup,
        getUTM: getUTM,
        SIGNUP_ENDPOINT: SIGNUP_ENDPOINT,
        ADVISOR_ENDPOINT: ADVISOR_ENDPOINT,
        TURNSTILE_SITE_KEY: TURNSTILE_SITE_KEY
    };
})();
