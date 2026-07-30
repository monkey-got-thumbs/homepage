#!/usr/bin/env node
/**
 * check-a11y.mjs — quality gate for the reading-level system.
 *
 * CLAUDE.md: "Parity is not enforced in code and fails silently: a missing key, a short (<5)
 * variant array, or a misnamed/404 JSON just leaves elements stuck on their inline text with no
 * error. There is no validator for this (unlike recall cards)."
 *
 * This is that validator. For every page carrying data-a11y it asserts:
 *   1. the a11y-content JSON exists at the slug accessibility.js will actually fetch
 *   2. every data-a11y key on the page has an entry in it
 *   3. every entry is an array of exactly 5 non-empty strings
 *   4. index 2 equals the element's inline HTML (whitespace-normalised — the repo authors inline
 *      HTML across indented lines and the JSON on one line, so this is text parity, not bytes)
 *   5. inline markup is preserved across all 5 variants: same tag counts, same hrefs as index 2.
 *      Variants are injected with innerHTML, so a dropped </strong> or a lost link ships silently.
 * It also warns about keys present in the JSON that no element uses (dead weight after an edit).
 *
 * Usage:  node scripts/check-a11y.mjs [--quiet]
 * Exits 1 on any error, 0 otherwise.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CONTENT_DIR = join(ROOT, 'assets', 'a11y-content');
const QUIET = process.argv.includes('--quiet');

/* Directories that legitimately have no shared chrome or no reading-level engine. */
const SKIP_DIRS = new Set(['lp', 'writers-digest', 'vendor', 'node_modules', 'scripts', 'content', '.git', '.github', '.claude', '.playwright-mcp', '.idea', 'assets', 'components']);

async function walk(dir, out = []) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await walk(join(dir, entry.name), out);
        } else if (entry.name.endsWith('.html')) {
            out.push(join(dir, entry.name));
        }
    }
    return out;
}

/** Mirrors pageSlug() in assets/js/accessibility.js — keep these two in step. */
function pageSlug(htmlPath) {
    let p = '/' + relative(ROOT, htmlPath).split(sep).join('/');
    p = p.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
    if (p === '') return 'home';
    return p.replace(/^\//, '').replace(/\//g, '-') || 'home';
}

/* Whitespace between tags is not content: the repo authors inline HTML across indented lines and
   the JSON on one line, so `</p>\n<p>` and `</p><p>` are the same painted result. */
const norm = (s) => s.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

/* Emphasis is a per-level style choice the authors make deliberately, so differences are warnings.
   Structural tags and links are not: dropping them changes what the reader can do. */
const SOFT_TAGS = new Set(['em', 'strong', 'b', 'i', 'code', 'small']);
const tagCounts = (s, soft) => {
    const m = s.match(/<\/?([a-zA-Z][\w-]*)/g) || [];
    return m.map((t) => t.toLowerCase().replace('/', ''))
        .filter((t) => (soft ? SOFT_TAGS.has(t.slice(1)) : !SOFT_TAGS.has(t.slice(1))))
        .sort().join(',');
};
const hrefs = (s) => (s.match(/href="([^"]*)"/g) || []).sort().join(',');

/* innerHTML on a void element paints nothing, so a data-a11y key there is silently dead. */
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);

/** Inner HTML of every data-a11y element, without a DOM. Managed elements are leaf-level prose. */
function managedElements(html) {
    const out = [];
    const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\bdata-a11y="([^"]+)"([^>]*)>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const [, tag, , key] = m;
        const close = `</${tag}>`;
        const end = html.indexOf(close, re.lastIndex);
        if (end === -1) { out.push({ key, inner: null, tag }); continue; }
        out.push({ key, tag, inner: html.slice(re.lastIndex, end) });
    }
    return out;
}

const errors = [];
const warnings = [];
let pagesChecked = 0, keysChecked = 0;

const pages = await walk(ROOT);
for (const page of pages) {
    const html = await readFile(page, 'utf8');
    const managed = managedElements(html);
    if (!managed.length) continue;
    pagesChecked++;

    const rel = relative(ROOT, page);
    const slug = pageSlug(page);
    const jsonPath = join(CONTENT_DIR, `${slug}.json`);

    let json;
    try {
        await stat(jsonPath);
        json = JSON.parse(await readFile(jsonPath, 'utf8'));
    } catch (e) {
        errors.push(`${rel}: ${managed.length} managed element(s) but assets/a11y-content/${slug}.json ${e.code === 'ENOENT' ? 'does not exist' : `is unreadable (${e.message})`} — every element silently keeps its inline text at all 5 levels`);
        continue;
    }

    const seen = new Set();
    for (const { key, inner, tag } of managed) {
        keysChecked++;
        seen.add(key);
        if (VOID.has(tag.toLowerCase())) {
            errors.push(`${rel} [${key}]: on a void <${tag}> element — innerHTML paints nothing there, so this key can never take effect`);
            continue;
        }
        if (inner === null) { errors.push(`${rel}: <${tag} data-a11y="${key}"> has no closing tag`); continue; }

        const variants = json[key];
        if (variants === undefined) { errors.push(`${rel} [${key}]: missing from ${slug}.json — element stays on inline text`); continue; }
        if (!Array.isArray(variants)) { errors.push(`${rel} [${key}]: not an array`); continue; }
        if (variants.length !== 5) { errors.push(`${rel} [${key}]: ${variants.length} variant(s), needs exactly 5`); continue; }

        variants.forEach((v, i) => {
            if (typeof v !== 'string' || !v.trim()) errors.push(`${rel} [${key}] level ${i + 1}: empty or not a string`);
        });

        if (norm(variants[2]) !== norm(inner)) {
            errors.push(`${rel} [${key}]: index 2 does not match the inline HTML — the JSON will silently repaint over the page on load\n      inline: ${norm(inner).slice(0, 110)}\n      json[2]: ${norm(variants[2]).slice(0, 110)}`);
        }
        const wantStruct = tagCounts(variants[2], false);
        const wantSoft = tagCounts(variants[2], true);
        const wantHrefs = hrefs(variants[2]);
        variants.forEach((v, i) => {
            if (tagCounts(v, false) !== wantStruct) errors.push(`${rel} [${key}] level ${i + 1}: structural markup differs from level 3 (${tagCounts(v, false) || 'none'} vs ${wantStruct || 'none'})`);
            if (hrefs(v) !== wantHrefs) errors.push(`${rel} [${key}] level ${i + 1}: links differ from level 3 — this reading level loses navigation the others have (${hrefs(v) || 'no links'} vs ${wantHrefs})`);
            if (tagCounts(v, true) !== wantSoft) warnings.push(`${rel} [${key}] level ${i + 1}: emphasis differs from level 3 (${tagCounts(v, true) || 'none'} vs ${wantSoft || 'none'})`);
        });
    }

    for (const key of Object.keys(json)) {
        if (!seen.has(key)) warnings.push(`${rel} [${key}]: in ${slug}.json but no element uses it`);
    }
}

if (!QUIET) {
    console.log(`check-a11y: ${pagesChecked} managed page(s), ${keysChecked} key(s) checked`);
    for (const w of warnings) console.log(`  warn  ${w}`);
}
for (const e of errors) console.error(`  ERROR ${e}`);
if (errors.length) {
    console.error(`\ncheck-a11y: ${errors.length} error(s).`);
    process.exit(1);
}
console.log(`check-a11y: OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
