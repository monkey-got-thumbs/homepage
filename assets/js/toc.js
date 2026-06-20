/* In-page Table of Contents for article pages.
 * External module (CSP `script-src 'self'`), progressive-enhancement: with JS off,
 * the [hidden] sidebar stays hidden and the article reads exactly as authored.
 * Builds a sticky sidebar TOC (shown >=64rem via CSS) + a collapsible "On this page"
 * fallback (shown <64rem), and a scroll-spy that highlights the current section.
 */
(function () {
    const article = document.querySelector('article.content.article-layout');
    if (!article) return;
    const mount = article.querySelector('[data-toc]');
    if (!mount) return;

    // Real content headings only: direct section > h2, minus the trailing
    // try-it / recall / "continue learning" card sections and screen-reader-only ones.
    const heads = Array.prototype.filter.call(
        article.querySelectorAll(':scope > section > h2'),
        (h) => !h.closest('.tryit, .recall-cta, .card') &&
               !h.classList.contains('sr-only') &&
               !(h.id && h.id.indexOf('tryit') === 0)
    );
    if (heads.length < 3) return;   // not worth a TOC

    const used = new Set();
    document.querySelectorAll('[id]').forEach((el) => used.add(el.id));

    const slugify = (text) => {
        let base = text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
        let slug = base, n = 2;
        while (used.has(slug)) slug = base + '-' + n++;
        used.add(slug);
        return slug;
    };

    const items = heads.map((h) => {
        if (!h.id) h.id = slugify(h.textContent || 'section');
        return { id: h.id, text: (h.textContent || '').trim(), el: h };
    });

    const buildList = () => {
        const ol = document.createElement('ol');
        items.forEach((it) => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#' + it.id;
            a.textContent = it.text;
            li.appendChild(a);
            ol.appendChild(li);
        });
        return ol;
    };

    // Sidebar (CSS reveals .is-ready at >=64rem)
    const title = document.createElement('p');
    title.className = 'toc__title';
    title.textContent = 'On this page';
    mount.appendChild(title);
    mount.appendChild(buildList());
    mount.classList.add('is-ready');
    mount.removeAttribute('hidden');

    // Collapsible fallback after <header> (CSS shows it <64rem)
    const header = article.querySelector(':scope > header');
    if (header) {
        const details = document.createElement('details');
        details.className = 'toc--inline';
        const summary = document.createElement('summary');
        summary.textContent = 'On this page';
        details.appendChild(summary);
        details.appendChild(buildList());
        header.insertAdjacentElement('afterend', details);
    }

    // Scroll-spy: highlight the sidebar link for the section nearest the top
    const linkById = {};
    mount.querySelectorAll('a').forEach((a) => { linkById[a.getAttribute('href').slice(1)] = a; });
    if (!('IntersectionObserver' in window)) return;

    let current = null;
    const setCurrent = (id) => {
        if (id === current) return;
        if (current && linkById[current]) linkById[current].removeAttribute('aria-current');
        current = id;
        if (current && linkById[current]) linkById[current].setAttribute('aria-current', 'true');
    };
    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
            else visible.delete(e.target.id);
        });
        if (visible.size) {
            // topmost visible heading wins
            let best = null, bestTop = Infinity;
            visible.forEach((top, id) => { if (top < bestTop) { bestTop = top; best = id; } });
            setCurrent(best);
        }
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
    items.forEach((it) => io.observe(it.el));
})();
