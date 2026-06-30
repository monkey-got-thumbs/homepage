# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. This is the deployed
**monkey-got-thumbs/homepage** repository — the public Monkey Got Thumbs site.

> Earlier versions of this file described a "single `index.html`, no build system."
> That is wrong. This is a **multi-page static site** (~85 HTML pages) with a real
> JS + web-components layer, a reading-level accessibility engine, Node build scripts,
> and an automated S3/CloudFront deploy. Read the relevant section before editing.

## Run it locally

```bash
# from this repo root (homepage/)
python3 -m http.server 8000      # then open http://localhost:8000
```

All asset paths are **root-relative** (`/assets/…`, `/components/…`, `/hero.webp`), so
the site **must be served from the repo root**. Opening a file via `file://` breaks CSS,
web components, and the reading-level swap. The same-origin `/api/*` endpoints (below)
do **not** exist locally, so LLM-backed features won't respond when served this way.

No framework, no bundler. There *are* Node build scripts (see **Build steps**) but they
are not needed for ordinary page/CSS/JS edits.

## Architecture — where things live

Entry point is the root **`index.html`**. `lang="en-GB"`, dark theme by default. Shared
chrome (header, footer, newsletter) is **not** a server include — it's delivered by web
components at runtime. Each page hand-rolls its own `<head>` (same CSS triad + meta) and
drops `<mgt-header>` / `<mgt-footer>` into the body.

| Path | What it is |
|------|------------|
| `index.html` | Homepage (hero · 3-step journey · recall taste · show-the-data · newsletter) |
| `learn/` | The curriculum — largest section. `foundations/`, `frameworks/`, `human-factors/`, `use-cases/`, `learning-paths/`, `start/`, `review/`, `influences.html` |
| `notes/` | **Generated** evergreen-note pages (built from `content/notes/*.md`) |
| `infographics/` | "Infographics you can poke" — at-a-glance visual + a live explorable bit (`good-at.html` + `assets/js/ig-fit.js`) |
| `explorables/` | 18 Bret-Victor-style interactive explanations (each `*.html` + same-named `*.js`) |
| `build/` | "Agents in plain English" + `build/advisor/` agent builder |
| `products/`, `community/`, `contact/`, `resources/`, `accessibility/`, `privacy/`, `terms/` | Standard content pages |
| `lp/` | 3 standalone marketing landing pages (no shared chrome) |
| `tools/`, `metron/` | Redirect stubs → `/products/` (not real content) |
| `writers-digest/` | Standalone in-browser app (`app/*.js`); built & deployed separately |
| `assets/css/` | 6 stylesheets (see **Design system**) |
| `assets/js/` | Page behaviour — IIFEs + ES modules (see **JavaScript**) |
| `assets/a11y-content/` | Per-page reading-level JSON (see **Reading-level system**) |
| `assets/fonts/` | Self-hosted woff2 (Montserrat, Bangers) |
| `components/core/` | Web components: `mgt-header`, `mgt-footer`, `mgt-newsletter`, `mgt-recall`, `mgt-credit` |
| `content/notes/` | Markdown **source** for `/notes/` (does not ship) |
| `scripts/` | Node build tooling (does not ship, not run by CI) |
| `vendor/` | Generated in-browser ML stack (gitignored) |

**7 pages intentionally have no `<mgt-header>`/`<mgt-footer>`:** the 3 `lp/*`, `writers-digest/index.html`,
`products/advisor/index.html` (standalone apps), and the `tools/` + `metron/` redirect stubs. Don't "fix" them by adding chrome.

## Design system (CSS)

CSS is **6 external stylesheets** in `assets/css/`, not an inline block:

- `tokens.css` — the source of truth: all custom properties on `:root` + `@font-face` (self-hosted fonts).
- `base.css` — reset, element typography, utilities.
- `layout.css` — page structure, sections, cards, hero, TOC, footer, the `/notes/` idea web.
- `accessibility.css` — runtime overrides keyed off `html[data-*]` (schemes, colour-vision, reading level).
- `journey.css` — the "Next step" handoff card.
- `learn-path.css` — lesson progress strip (only the 14 learn-track lesson pages link it).

**Include order matters** and is consistent on every page:
`tokens.css` → `base.css` → `layout.css` → page-local inline `<style>` → `accessibility.css` → `journey.css`.
Keep `accessibility.css` **after** the inline `<style>` so its `[data-scheme]`/`[data-level]` overrides win.

**Tokens are namespaced** — reuse them, never hard-code colours (hard-coded colours won't adapt to the
schemes/reading-levels the accessibility engine applies):

- Colour: `--color-bg` `#0E0B1A`, `--color-bg-secondary`, `--color-fg`, `--color-fg-secondary`, `--color-accent` `#A6FF4D` (lime), `--color-brand` `#503E94`, `--color-brand-light`, `--color-muted`, `--color-border`, `--color-success/-warning/-error/-info`.
- Space: `--space-xs … --space-4xl` (0.25rem → 6rem).
- Type: `--font-sans` (Montserrat), `--font-display` (Bangers), `--font-mono`; `--font-size-xs … -5xl`; weights/line-heights.
- Radius/layout: `--radius`, `--radius-lg`, `--radius-full`; `--content-col` (68rem), `--measure` (42rem), `--container-wide`, `--header-h`.

Dark is the default (token values live on `:root` + `<meta name="color-scheme" content="dark">`).
Light/contrast/sepia are opt-in via `html[data-scheme=…]` in `accessibility.css`. Don't re-add
Google Fonts (fonts are self-hosted in `assets/fonts/`). Don't add a global `header {}` rule — the
nav is the `<mgt-header>` shadow-DOM component and content pages reuse `<header>` for title blocks.

## JavaScript & web components

**CSP is a hard rule.** All behaviour is **external, same-origin JS** wired via `addEventListener`.
There are **zero inline `<script>` bodies and zero inline `on*=` handlers** in the repo (only
`type="application/ld+json"` blocks). The CSP itself is enforced at the CloudFront header layer
(not in the repo), so keep everything in `/assets/js/` or `/components/`. Don't introduce inline JS.

Two loading conventions, and they don't mix:

- **Classic IIFE** (`<script src defer>`, no import/export): `accessibility.js`, `journey.js`, `tracking.js`, `ig-fit.js`, `toc.js`, `copy.js`, `learn-path.js`, `sounding-board.js`, the `explorable-*.js`.
- **ES modules** (`<script type="module">`): `app.js`, `srs.js`, `review.js`, `learn-nudge.js`, and all `components/core/*.js`.

Don't add `import`/`export` to an IIFE file or expect a module to set globals before the defer scripts run.

- `a11y-init.js` — tiny IIFE loaded **synchronously in `<head>` (no defer)** so it sets `<html>` data-* before first paint. Don't add defer/async or a flash returns.
- `app.js` — bootstrap (focus-visible, skip link, reduced-motion, injects `/chatyman.js`); exposes `window.MGT`.
- `srs.js` — local-first Leitner spaced-repetition engine (localStorage `mgt:srs:v1`). Imported by `review.js`, `learn-nudge.js`, and `<mgt-recall>`. Its localStorage schema is a shared contract.
- `components/core/*.js` — custom elements in open shadow DOM, self-registering on module load. `mgt-recall`/`mgt-credit` keep light-DOM fallback content so the page degrades with JS off — keep it.

LLM-backed UI (`sounding-board.js`, advisor) renders model output as **text, never HTML**. Explorables
use pre-written representative answers, not live model calls.

## Reading-level system (`data-a11y` ⇄ a11y-content JSON) — read before editing copy

This is the subsystem most likely to bite you. The accessibility panel lets readers pick a **reading
level 1–5** (default 3). `accessibility.js` swaps managed prose to match:

- Elements that carry copy are marked `data-a11y="<key>"`.
- On load it fetches `/assets/a11y-content/<slug>.json`, where `<slug>` = the path with `index.html`/`.html`/trailing-`/` stripped and remaining `/` → `-` (root = `home`). E.g. `/learn/foundations/` → `learn-foundations.json`, `/notes/show-the-data.html` → `notes-show-the-data.json`.
- Each JSON value is an **array of 5 HTML strings** (index 0 = level 1 … index 4 = level 5). The **inline HTML shipped in the page is the level-3 (index 2) variant**, and on every load the JSON's value is painted over the inline HTML.

**Therefore: to change copy on a managed element you must edit BOTH the inline HTML and the JSON's
index-2 string** (ideally all 5 variants). Editing only the visible HTML appears to work, then the stale
JSON repaints over it on next load. **Parity is not enforced in code and fails silently:** a missing key,
a short (<5) variant array, or a misnamed/404 JSON just leaves elements stuck on their inline text with no
error. There is no validator for this (unlike recall cards) — keep keys and JSON in sync by hand.
Variants are injected via `innerHTML`, so they're trusted first-party HTML — keep them well-formed.

## Build steps (run from repo root; none are run by CI)

```bash
node scripts/build-notes.mjs     # regenerate /notes/*.html from content/notes/*.md (wikilinks → backlinks)
node scripts/check-cards.mjs     # quality-gate <mgt-recall> cards under learn/ (dup/missing ids, length)
bash scripts/build-vendor.sh     # rebuild the in-browser ML stack under vendor/ (gitignored)
```

`/notes/*.html` is **generated** — to change a note, edit `content/notes/<slug>.md` and rerun
`build-notes.mjs`; don't hand-edit the note HTML. Run `check-cards.mjs` after touching recall cards.

## Deploy

`.github/workflows/deploy.yml` deploys on **push to `main`** (or manual dispatch). It is **not** GitHub
Pages — it's **S3 + CloudFront via GitHub OIDC** (no long-lived keys):

1. Assume `arn:aws:iam::704225641352:role/github-deploy` (region `ap-southeast-2`).
2. `aws s3 sync` the site to `s3://codeology-mgt-site-704225641352/` — **additive (no `--delete`)**. Excludes `.git`, `.github`, `.claude`, `.playwright-mcp`, `scripts/`, `content/`, `vendor/`, `writers-digest/`, `*.md`, `CNAME`, `.DS_Store`; `notes/*` is excluded **except** `notes/*.html`.
3. Build Writers Digest separately into `out/` (generates `app/config.js` with `WD_LLM_ENDPOINT='/api/wd'`) and sync to `/writers-digest/` **with `--delete`**.
4. Invalidate CloudFront `E1HGY9I3DL1PFX`.

Served at **mgt.codeology.co.nz** (CloudFront). The `CNAME` file and all canonical/OG/sitemap URLs use
**monkey-got-thumbs.com** (the public production domain). `*.md` files (including this one) are excluded
from the sync, so docs never ship.

**Not in this repo, not deployed by this CI:** the `/api/*` Lambda backends, the S3/CloudFront/IAM infra,
and all Terraform. There are zero `*.tf` files here. Sibling directories like `../terraform/` and
`../projects/` live outside this git repo entirely — committing/pushing here does nothing to them.

## Same-origin APIs (absent in local dev)

The frontend POSTs same-origin; CloudFront routes to pre-existing Lambdas:

- `/api/llm` — Amazon Nova 2 Lite. Body `{system, messages, max_tokens, temperature}` → `{text}` / `{error}`. Used by `sounding-board.js`.
- `/api/wd` — Writers Digest LLM (wired at deploy via `config.js`).
- `/api/signup` — newsletter (`tracking.js` → `submitSignup`).
- `/api/advisor` — agent-builder advisor (kereru.ai behind a Lambda).

Render any model output as **text, never HTML**.

## Coding standards

- Semantic HTML5 (`header`, `main`, `section`, `article`, `nav`, `footer`); four-space indentation; keep the existing attribute-wrapping style.
- **en-GB** spelling throughout (the site is `lang="en-GB"`).
- Reuse `assets/css/tokens.css` variables before adding new ones; **never hard-code colours** — they must adapt across schemes and reading levels. Meet WCAG AA contrast.
- New behaviour = external CSP-safe JS in `/assets/js` (pick IIFE vs module to match how the page loads it); no inline scripts/handlers.
- New assets: lowercase kebab-case under `/assets/` (`cta-banner.webp`); optimise images (≤200 KB), prefer `.webp`.
- Adding a page: copy the shared `<head>` triad + meta, include `<mgt-header>`/`<mgt-footer>`, add `data-a11y` keys **with** a matching `assets/a11y-content/<slug>.json`, and add the URL to `sitemap.xml`.
- Accessibility and the "guide, don't preach" stance are non-negotiable — every component must work across all schemes and all 5 reading levels.

## Commit & PR

- Short, imperative subjects (`Adjust hero spacing`); body only when context helps.
- Keep visual, content, and infrastructure changes in **separate commits** for clean review/rollback.
- PRs: describe the change, list manual checks, attach before/after screenshots for UI tweaks.
- Only `homepage/` is a git repo here; pushing `main` triggers the live deploy above.

> See also `AGENTS.md` (kept in sync with this file).
