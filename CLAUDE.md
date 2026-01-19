# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Engaged California is a civic engagement platform built as a static site using 11ty (Eleventy) v3. The site supports 9 languages and features custom data visualizations for analyzing public comments on state government topics (LA fires response, state employee engagement).

## Common Commands

### Development
```bash
npm run start        # Start dev server with live reload at http://localhost:8080
npm run build        # Production build to _dist/
```

### Code Quality
```bash
npm run check        # Run Biome linting and formatting (auto-fix)
npm run format       # Format code with Biome
npm run lint         # Lint code with Biome
```

### Testing
```bash
npm run test:setup   # Install Playwright dependencies (first time only)
npm run test         # Run Playwright accessibility tests
npm run test:serve   # Build and serve for testing
```

### Data Processing (Python)
Data processing scripts are in `/scripts/` and are **not part of the build**. The main E3 data processing pipeline:

```bash
cd scripts/e3_report_data
python process_data_v5.py  # Process CSV data into JSON for state employees report
```

This generates `/src/public/data/E3_data_v5.json` from CSV files containing comments and AI-extracted solution themes.

## Architecture

### Directory Structure

- **`/site/`** - 11ty input directory
  - **`_includes/`** - Nunjucks templates, layouts, and components
  - **`_data/`** - Global data files (i18n.js contains all translations)
  - **`en/`, `es/`, `ko/`, etc.** - Localized content directories (9 languages)
- **`/src/`** - Source assets processed during build
  - **`css/`** - CSS source files (processed with LightningCSS)
  - **`js/`** - JavaScript source (bundled with esbuild)
  - **`public/`** - Static assets copied to `_dist/public/`
  - **`root/`** - Files copied to site root (favicons, robots.txt)
- **`/_dist/`** - Build output (git-ignored)
- **`/scripts/`** - Helper utilities NOT part of the build
- **`/test/`** - Playwright accessibility tests

### Build System

The build is orchestrated in `eleventy.config.js`:

1. **CSS Processing** (LightningCSS)
   - Entry point: `src/css/index.css` imports modular CSS files
   - Features: CSS nesting support, minification
   - Outputs 7 separate CSS bundles (index, action-plan, fires, state-employees-report, etc.)

2. **JavaScript Bundling** (esbuild)
   - Entry point: `src/js/index.js`
   - Bundles Web Components for forms and custom elements
   - Single minified output

3. **Asset Pipeline**
   - `eleventy.before` hook: Builds CSS/JS before 11ty runs
   - `eleventy.beforeWatch` hook: Rebuilds only changed assets during dev
   - Passthrough copy for static assets

### Custom .mmmd File Format

**Many Modules Markdown (MMMD)** solves the problem of maintaining high-design pages without splitting content across dozens of files.

**Structure:**
```markdown
---
title: Page title
layout: template-name
---

Main markdown content here

----
id: moduleId1
custom_field: value
----
Module content in markdown

----
id: moduleId2
----
Another module
```

**Key Points:**
- Four dashes (`----`) delimit modules (vs three for standard frontmatter)
- Each module MUST have an `id` field
- Modules available in templates via `modules.moduleId.content` and `modules.moduleId.*`
- Content is parsed as markdown and rendered to HTML
- See `/docs/mmmd.md` for full documentation

**Usage in Templates:**
```nunjucks
{{ modules.myModule.title }}
{{ modules.myModule.content | safe }}
```

**Example:** `/site/en/about.mmmd` defines 4 modules, then `/site/_includes/mmmd-about.njk` renders them with custom layouts.

### Internationalization (i18n)

**Supported Languages:** English (en), Spanish (es), Korean (ko), Tagalog (tl), Vietnamese (vi), Simplified Chinese (zh-hans), Traditional Chinese (zh-hant), Farsi (fa), Armenian (hy)

**Translation System:**
- All translations in `/site/_data/i18n.js`
- Use filter in templates: `{{ 'translation-key' | i18n }}`
- Auto-fallback to English if translation missing

**URL Structure:**
- English at root: `/about/`
- Other languages: `/es/about/`, `/ko/about/`, etc.

**Custom Filters:**
- `pagePath` - Generate language-specific URLs for language switcher
- `relativePath` - Canonical URLs without locale prefix
- `localizedPath` - Add locale prefix to internal links

### Data Processing Pipeline (E3 Report)

The state employees report features a theme explorer with 2,477 comments and 2,627 AI-extracted solution ideas.

**Source Files:** (in `/scripts/e3_report_data/`)
- `E3_data_v5.csv` - Comment data
- `e3_solution_themes_v5.csv` - AI-extracted solutions mapped to themes/subthemes

**Processing Script:** `process_data_v5.py`
- Fixes encoding issues (mojibake)
- Dynamically builds theme/subtheme mapping from solutions file
- Orders themes by solution count (descending)
- Calculates reply trees
- Outputs `E3_data_v5.json` (2.5MB) to `/src/public/data/`

**Output Structure:**
```json
{
  "unique_questions": [...],
  "themes": [...],        // 10 themes
  "subthemes": [...],     // 65 subthemes
  "comments": [...],
  "solutions": [...]
}
```

**Consumed By:** `/site/_includes/e3-theme-navigation.njk` - Interactive theme explorer with search/filters

### Component Architecture

**Pattern:** Nunjucks templates + includes + macros + modules

**Key Components:**
- **Layouts:** `layout.njk` (base), `page.njk` (simple wrapper)
- **MMMD Templates:** `mmmd-about.njk`, `mmmd-homepage.njk`, `mmmd-stateemployees-report.njk`
- **Form Components:** Macros in `/site/_includes/macros/` (form-checkbox.njk, form-radio.njk, etc.)
- **Visualizations:** LA fires charts, E3 theme navigation

**Web Components (Custom Elements):**
- `engca-join-convo-form` - Form with validation and API submission
- `engca-icon-heading`, `engca-section-content` - Structural components
- Defined in `/src/js/index.js`

### CSS Architecture

**Modular CSS with LightningCSS:**
- Entry point: `src/css/index.css` imports all modules
- Uses CSS nesting (native, not SCSS)
- CSS custom properties for theming
- Page-specific bundles to reduce payload
- RTL support via `rtl.css`

**Third-party Libraries:** (inline in templates)
- GSAP, Lenis, ScrollTrigger (in `_includes/` directory)

### Testing

**Playwright** for accessibility and E2E testing:
- Tests in `/test/index.spec.js`
- Uses axe-playwright for accessibility checks
- Tests against local server at `http://localhost:8080`

## Development Workflow

1. **Content Changes:**
   - Edit `.mmmd` or `.md` files in `/site/[locale]/`
   - MMMD modules must have unique `id` fields
   - Run `npm run start` to preview changes

2. **Template Changes:**
   - Edit Nunjucks templates in `/site/_includes/`
   - Access MMMD modules via `modules.moduleId.content`
   - Use `{{ 'key' | i18n }}` for translations

3. **Style Changes:**
   - Edit CSS in `/src/css/`
   - Uses CSS nesting syntax
   - Build automatically triggers via watch mode

4. **JavaScript Changes:**
   - Edit `/src/js/index.js`
   - Web Components use standard Custom Elements API
   - Build automatically triggers via watch mode

5. **Data Processing:**
   - Python scripts in `/scripts/` (separate from build)
   - Process CSV → JSON, then commit JSON to `/src/public/data/`
   - Version-controlled data ensures consistent builds

## Deployment

- **Production:** AWS S3 + CloudFront via GitHub Actions (`deploy_prod.yml`)
- **Preview:** PR-based preview environments (`deploy_preview.yml`)
- **Branch:** Deploy from `main` branch
- **Node Version:** 18.17.0 (managed by Volta)

## Important Notes

- **Biome** replaces both ESLint and Prettier for linting/formatting
- **No CMS** - Content managed via Git/GitHub PRs
- **Static data** - E3 data pre-processed and committed (not fetched at build time)
- **No build-time API calls** - All data is version-controlled
- Site output is fully static HTML/CSS/JS (no server-side runtime)
