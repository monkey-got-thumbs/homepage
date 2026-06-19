# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Monkey Got Thumbs** is a static HTML landing site for an augmented-intelligence collaboration platform. There is no build system, bundler, or framework—just HTML, CSS, and assets.

## Architecture & Key Files

**Single-Page Entry Point:**
- `index.html` — Contains all layout, inline styles, and JSON-LD structured data. This is the only HTML file.

**Brand Assets:**
- `logo.png` — Navigation logo (referenced as 80×80)
- `hero.png` — Hero section illustration (referenced as 1120×630)
- `favicon.png` — Browser favicon

**Configuration:**
- `CNAME` — Deployment domain pin; update only if the production host changes

**Documentation & Research:**
- `notes/` — Directory holding drafts, research, and copy decks that do not ship to production
- `AGENTS.md` — Repository guidelines and coding standards (this document)

## Development Workflow

### Serve Locally
```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

### Quick Markup Validation (macOS)
```bash
open index.html
```
Useful for spot-checking without a server when asset paths are relative.

### Quality Checks
```bash
npx htmlhint index.html        # Check markup issues
npx lighthouse http://localhost:8000 --view   # Accessibility & performance audit
```

Target Lighthouse scores: ≥90 for Performance and Accessibility. Include the report URL in PRs for notable changes.

### Manual Testing
- Verify layouts in Chrome, Safari, and Firefox (latest versions)
- Test responsive design down to 320 px width
- Capture before/after screenshots for UI changes in PRs

## Coding Standards

### HTML & Semantic Structure
- Use semantic HTML5 elements (`header`, `main`, `section`, `footer`, `article`)
- Maintain four-space indentation
- Keep existing attribute wrapping style

### CSS
- Extend the existing CSS block in place (no separate stylesheets)
- Reuse `:root` custom properties before introducing new tokens:
  - `--bg`, `--fg`, `--accent`, `--brand`, `--brand-600`, `--muted`
  - `--radius`, `--maxw`, `--sans`, `--display`
- Verify color contrast meets WCAG AA+ standards

### Asset Naming & Placement
- Use lowercase kebab-case for new assets (`cta-banner.png`)
- Place images alongside other assets in the project root
- Optimize for web: aim for ≤200 KB while preserving dimensions
- Use `loading="eager"` and `fetchpriority="high"` for above-the-fold images

### Form Integration
The contact form (line 241) submits to `staticcontact.com` with a honeypot field for spam prevention. Do not remove or alter the honeypot.

## Git & Pull Requests

**Commit Style:**
- Short, imperative subjects (e.g., `Adjust hero spacing`)
- Add a body only when context is needed
- Keep visual, content, and infrastructure changes in separate commits

**Pull Request Guidelines:**
- Describe the change clearly
- List manual checks performed
- Attach before/after screenshots for UI tweaks
- Reference related issues or tickets

## Common Tasks

**Update Copy or Links:**
Edit the relevant section in `index.html` directly. No rebuild needed.

**Change Colors or Spacing:**
Modify `:root` custom properties or inline styles in the `<style>` block. Test in multiple browsers.

**Replace Brand Assets:**
Save new images to the project root (e.g., `logo.png`), ensuring they match or exceed the referenced dimensions. Optimize to ≤200 KB.

**Update Metadata:**
Edit SEO meta tags, Open Graph, Twitter Card, and JSON-LD in the `<head>`. Remember to replace `yourdomain.com` placeholder URLs.
