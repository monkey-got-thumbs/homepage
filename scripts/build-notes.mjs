#!/usr/bin/env node
/**
 * build-notes.mjs — generate the evergreen /notes/ web from content/notes/*.md
 *
 * Dependency-free. Each note is atomic + claim-titled. Notes link to each other
 * with [[slug]] (or [[slug|label]]) wikilinks; backlinks ("Linked from") are
 * computed automatically. Output pages reuse the shared site shell + design system.
 *
 * Inspired by Andy Matuschak's evergreen-notes practice — mechanism re-implemented
 * in our own code; see /learn/influences.html.
 *
 * Run from homepage/:  node scripts/build-notes.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'content', 'notes');
const OUT = join(ROOT, 'notes');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- parse a note file (frontmatter + body) ---------- */
function parseNote(file) {
    const raw = readFileSync(join(SRC, file), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const meta = {};
    let body = raw;
    if (m) {
        body = m[2];
        for (const line of m[1].split('\n')) {
            const i = line.indexOf(':');
            if (i < 0) continue;
            meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        }
    }
    const slug = (meta.slug || basename(file, '.md')).trim();
    return {
        slug,
        title: meta.title || slug,
        tags: (meta.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
        summary: meta.summary || '',
        body,
        outgoing: new Set(),
    };
}

/* ---------- inline markdown (operates on already-escaped text) ---------- */
function inline(text, ctx) {
    let t = esc(text);
    // [[slug]] / [[slug|label]] wikilinks
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slugRaw, labelRaw) => {
        const slug = slugRaw.trim();
        const label = (labelRaw || '').trim();
        if (ctx.from) ctx.from.outgoing.add(slug);
        const known = ctx.titleBySlug.has(slug);
        const shown = label || (known ? ctx.titleBySlug.get(slug) : slug);
        if (!known) {
            ctx.warnings.push(`${ctx.from ? ctx.from.slug : '?'}: unknown wikilink [[${slug}]]`);
            return esc(shown);
        }
        return `<a href="/notes/${slug}.html" class="wikilink">${esc(shown)}</a>`;
    });
    // [text](url) standard links (groups already escaped)
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
        const external = /^https?:/i.test(url);
        const href = url.replace(/"/g, '&quot;');   // esc() handled & < > earlier; keep quotes from breaking the attribute
        return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    });
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    return t;
}

/* ---------- block markdown ---------- */
const BLOCK_START = /^(#{1,4}\s|>\s?|\s*[-*]\s+|\s*\d+\.\s+)/;
function renderBody(body, ctx) {
    const lines = body.replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (/^\s*$/.test(line)) { i++; continue; }
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) { out.push(`<h${h[1].length}>${inline(h[2], ctx)}</h${h[1].length}>`); i++; continue; }
        if (/^>\s?/.test(line)) {
            const buf = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
            out.push(`<blockquote>${inline(buf.join(' '), ctx)}</blockquote>`);
            continue;
        }
        if (/^\s*[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''), ctx)}</li>`); i++; }
            out.push(`<ul>${items.join('')}</ul>`);
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''), ctx)}</li>`); i++; }
            out.push(`<ol>${items.join('')}</ol>`);
            continue;
        }
        const buf = [];
        while (i < lines.length && !/^\s*$/.test(lines[i]) && !BLOCK_START.test(lines[i])) { buf.push(lines[i]); i++; }
        out.push(`<p>${inline(buf.join(' '), ctx)}</p>`);
    }
    return out.join('\n            ');
}

/* ---------- HTML shell ---------- */
function head(title, desc, canonical, jsonld, ogType = 'article') {
    return `<!DOCTYPE html>
<html lang="en-GB">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
    <title>${esc(title)}</title>
    <link rel="canonical" href="${canonical}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#0E0B1A" />
    <meta name="color-scheme" content="dark">
    <link rel="stylesheet" href="/assets/css/tokens.css">
    <link rel="stylesheet" href="/assets/css/base.css">
    <link rel="stylesheet" href="/assets/css/layout.css">
    <meta name="description" content="${esc(desc)}" />
    <meta name="author" content="Monkey Got Thumbs" />
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:image" content="https://monkey-got-thumbs.com/social-card.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:alt" content="Monkey Got Thumbs — a friendly monkey, thumbs up, on a dark background">
    <meta property="og:site_name" content="Monkey Got Thumbs">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="https://monkey-got-thumbs.com/social-card.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
    <script type="application/ld+json">
    ${jsonld}
    </script>
</head>
<body>
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <mgt-header></mgt-header>
    <main id="main-content">`;
}
const FOOT = `    </main>
    <mgt-footer></mgt-footer>
    <script src="/assets/js/tracking.js" defer></script>
    <script type="module" src="/assets/js/app.js"></script>
    <script type="module" src="/components/core/mgt-header.js"></script>
    <script type="module" src="/components/core/mgt-footer.js"></script>
    <script type="module" src="/components/core/mgt-credit.js"></script>
</body>
</html>
`;

/* ---------- build ---------- */
function build() {
    if (!existsSync(SRC)) { console.error(`No source dir: ${SRC}`); process.exit(1); }
    const files = readdirSync(SRC).filter((f) => f.endsWith('.md'));
    const notes = files.map(parseNote);
    const bySlug = new Map(notes.map((n) => [n.slug, n]));
    const titleBySlug = new Map(notes.map((n) => [n.slug, n.title]));
    const warnings = [];

    // render bodies (also populates each note's outgoing set)
    for (const n of notes) {
        n.html = renderBody(n.body, { titleBySlug, from: n, warnings });
    }
    // backlinks
    const backlinks = new Map(notes.map((n) => [n.slug, []]));
    for (const n of notes) {
        for (const target of n.outgoing) {
            if (bySlug.has(target) && target !== n.slug) backlinks.get(target).push(n.slug);
        }
    }

    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

    // note pages
    for (const n of notes) {
        const desc = n.summary || n.title;
        const canonical = `https://monkey-got-thumbs.com/notes/${n.slug}.html`;
        const jsonld = JSON.stringify([
            {
                '@context': 'https://schema.org', '@type': 'Article', headline: n.title,
                description: desc, url: canonical,
                image: 'https://monkey-got-thumbs.com/social-card.png',
                mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
                author: { '@type': 'Organization', name: 'Monkey Got Thumbs' },
                publisher: { '@type': 'Organization', name: 'Monkey Got Thumbs', logo: { '@type': 'ImageObject', url: 'https://monkey-got-thumbs.com/logo.png', width: 200, height: 300 } },
                datePublished: '2026-06-20', dateModified: '2026-06-20',
            },
            {
                '@context': 'https://schema.org', '@type': 'BreadcrumbList',
                itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://monkey-got-thumbs.com/' },
                    { '@type': 'ListItem', position: 2, name: 'Notes', item: 'https://monkey-got-thumbs.com/notes/' },
                    { '@type': 'ListItem', position: 3, name: n.title },
                ],
            },
        ]);
        const back = backlinks.get(n.slug).sort();
        const backHtml = back.length
            ? `\n            <aside class="backlinks" aria-label="Notes that link here">
                <h2>Linked from</h2>
                <ul>${back.map((s) => `\n                    <li><a href="/notes/${s}.html">${esc(titleBySlug.get(s))}</a></li>`).join('')}
                </ul>
            </aside>`
            : '';
        const tagsHtml = n.tags.length
            ? `\n                <p class="note-tags">${n.tags.map((t) => `<span>${esc(t)}</span>`).join(' ')}</p>`
            : '';
        const page = head(`${n.title} — Notes — Monkey Got Thumbs`, desc, canonical, jsonld) + `
        <article class="content note">
            <nav aria-label="Breadcrumb">
                <ul class="breadcrumbs">
                    <li><a href="/">Home</a></li>
                    <li><a href="/notes/">Notes</a></li>
                    <li><span aria-current="page">${esc(n.title)}</span></li>
                </ul>
            </nav>
            <header>
                <h1>${esc(n.title)}</h1>${tagsHtml}
            </header>
            <div class="note-body">
            ${n.html}
            </div>${backHtml}
            <mgt-credit>This is an <strong>evergreen note</strong> — atomic, claim-titled, and densely linked — a practice from Andy Matuschak, re-implemented in our own words.</mgt-credit>
            <p class="note-foot"><a href="/notes/">← All notes</a> &middot; <a href="/learn/">Learning Hub</a></p>
        </article>
` + FOOT;
        writeFileSync(join(OUT, `${n.slug}.html`), page);
    }

    // index
    const sorted = [...notes].sort((a, b) => a.title.localeCompare(b.title));
    const canonical = 'https://monkey-got-thumbs.com/notes/';
    const idxJsonld = JSON.stringify([
        {
            '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Notes — Monkey Got Thumbs',
            url: canonical, description: 'A growing web of short, linked notes on augmented intelligence.',
        },
        {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://monkey-got-thumbs.com/' },
                { '@type': 'ListItem', position: 2, name: 'Notes' },
            ],
        },
    ]);
    const cards = sorted.map((n) => `\n                <li class="note-card"><a href="/notes/${n.slug}.html"><span class="note-card__title">${esc(n.title)}</span>${n.summary ? `<span class="note-card__sum">${esc(n.summary)}</span>` : ''}<span class="note-card__meta">${backlinks.get(n.slug).length} link${backlinks.get(n.slug).length === 1 ? '' : 's'} in</span></a></li>`).join('');
    const index = head('Notes — a growing web of ideas — Monkey Got Thumbs',
        'Short, claim-titled, densely linked notes on augmented intelligence — AI as one tool for thinking. A growing web you can wander.',
        canonical, idxJsonld, 'website') + `
        <article class="content u-wide">
            <nav aria-label="Breadcrumb">
                <ul class="breadcrumbs">
                    <li><a href="/">Home</a></li>
                    <li><span aria-current="page">Notes</span></li>
                </ul>
            </nav>
            <header>
                <h1>Notes</h1>
                <p class="lead">A growing web of short, linked ideas about augmented intelligence — the conviction that <strong>AI is one tool for thinking, not the thinker</strong>. Each note states one claim and links to the others. Follow a thread; you won't lose your place.</p>
            </header>
            <div class="enduring">
                <p><strong>How to read this:</strong> these are <em>evergreen notes</em> — each titled with a single claim, kept short, and linked to its neighbours. Start anywhere and follow the links. "Linked from" at the foot of each note shows what points back to it.</p>
            </div>
            <ul class="notes-index">${cards}
            </ul>
            <mgt-credit>The evergreen-notes practice behind this page is Andy Matuschak's; we re-implemented the mechanism in our own words. See <a href="/learn/influences.html">Influences &amp; credits</a>.</mgt-credit>
        </article>
` + FOOT;
    writeFileSync(join(OUT, 'index.html'), index);

    console.log(`✓ Built ${notes.length} notes + index → /notes/`);
    const orphans = notes.filter((n) => backlinks.get(n.slug).length === 0 && n.outgoing.size === 0);
    if (orphans.length) console.log(`  note: ${orphans.length} unlinked note(s): ${orphans.map((n) => n.slug).join(', ')}`);
    if (warnings.length) { console.log(`  ${warnings.length} warning(s):`); warnings.forEach((w) => console.log(`    ! ${w}`)); }
    else console.log('  0 warnings — all wikilinks resolve.');
}

build();
