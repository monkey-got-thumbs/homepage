# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the single-page entry point; it contains the layout, inline styles, and JSON-LD metadata.
- `favicon.png`, `hero.png`, and `logo.png` hold brand assets—optimize replacements for web (≤200 KB) while preserving dimensions.
- `CNAME` pins the production domain; update it only when the deployment host changes.
- Use `notes/` for drafts or copy decks that should not ship; keep files in Markdown or plain text for easy diffing.

## Build, Test, and Development Commands
- `python3 -m http.server 8000` — serve the site locally from the repository root and visit `http://localhost:8000`.
- `open index.html` (macOS) — spot-check markup without a server when asset paths are relative.
- `npx lighthouse http://localhost:8000 --view` — run an accessibility and performance audit; store the report URL in the PR if notable.

## Coding Style & Naming Conventions
- Match the existing four-space indentation and attribute wrapping style in `index.html`; keep semantic HTML5 elements first (e.g., `header`, `main`, `section`).
- Extend the CSS block in place; reuse the `:root` custom properties before introducing new color or spacing tokens.
- Name new assets with lowercase kebab-case (`cta-banner.png`) and place them alongside the other images in the project root.

## Testing Guidelines
- No automated suite exists; manually verify layouts in the latest Chrome, Safari, and Firefox, and confirm mobile responsiveness down to 320 px width.
- Run `npx htmlhint index.html` to catch markup issues before opening a PR.
- Capture Lighthouse scores (target ≥90 for Performance and Accessibility) after meaningful UI changes and summarize findings in the PR.

## Commit & Pull Request Guidelines
- Follow the project’s history by using short, imperative commit subjects (e.g., `Adjust hero spacing`); add a body only when context is needed.
- Keep visual, content, and infrastructure updates in separate commits to simplify review and rollbacks.
- Pull requests should describe the change, list the manual checks performed, attach before/after screenshots for UI tweaks, and reference any related issue or ticket.
