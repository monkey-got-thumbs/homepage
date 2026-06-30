# Repository Guidelines

This is **monkey-got-thumbs/homepage** — the deployed Monkey Got Thumbs site. It is a
**multi-page static site** (~85 HTML pages) with a JS + web-components layer, a reading-level
accessibility engine, Node build scripts, and an automated S3/CloudFront deploy.

**`CLAUDE.md` is the full, authoritative guide** (architecture, design tokens, the `data-a11y`
reading-level system, build scripts, deploy). Read it before non-trivial work. This file is the
short version, kept in sync.

## Structure & local dev
- Entry point is the root `index.html`; content lives across `learn/`, `notes/`, `infographics/`, `explorables/`, `build/`, `products/`, `community/`, etc. Shared chrome is the `<mgt-header>`/`<mgt-footer>` web components in `components/core/`.
- Shared CSS is `assets/css/*.css` (tokens, base, layout, accessibility, journey, learn-path); JS is `assets/js/*.js`; reading-level copy is `assets/a11y-content/*.json`.
- Serve from the repo root: `python3 -m http.server 8000`. Root-relative paths and the `/api/*` endpoints mean `file://` and offline LLM features won't work.

## Coding style
- Semantic HTML5, four-space indentation, existing attribute-wrapping style, **en-GB** spelling.
- Reuse `assets/css/tokens.css` custom properties (`--color-*`, `--space-*`, `--font-*`, `--radius*`); never hard-code colours (they must adapt across schemes and the 5 reading levels). WCAG AA.
- All behaviour is **external, CSP-safe JS** — no inline `<script>` bodies or `on*=` handlers. Match the file's load style (IIFE `defer` vs `type="module"`).
- New assets: lowercase kebab-case under `/assets/` (`cta-banner.webp`), optimised (≤200 KB).

## Editing copy & content (gotchas)
- Pages with `data-a11y="key"` are reading-level managed: the visible HTML is the level-3 variant and is repainted from `assets/a11y-content/<slug>.json` on load. **Edit both the inline HTML and the JSON** (parity is required and fails silently).
- `/notes/*.html` is **generated** — edit `content/notes/*.md` and run `node scripts/build-notes.mjs`.
- After touching `<mgt-recall>` cards, run `node scripts/check-cards.mjs`.

## Testing
- No automated suite. Verify in latest Chrome/Safari/Firefox; check responsiveness to 320 px.
- `npx htmlhint <file>` for markup; `npx lighthouse http://localhost:8000 --view` (target ≥90 Performance & Accessibility) for notable UI changes.

## Deploy, commits & PRs
- Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) syncs to S3 + invalidates CloudFront (serves mgt.codeology.co.nz). `*.md`, `scripts/`, `content/`, `vendor/` don't ship. Terraform and the `/api/*` backends are **not** in this repo.
- Short, imperative commit subjects; keep visual, content, and infra changes in separate commits.
- PRs: describe the change, list manual checks, attach before/after screenshots for UI tweaks.
