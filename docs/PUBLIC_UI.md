# NodePress Public UI Modernization

Phased rollout of the public-facing design system, templates, and interactions.

## Phase checklist

| Phase | Scope | Key assets |
| --- | --- | --- |
| 1 | Audit & planning | Baseline templates and CSS inventory |
| 2 | Design tokens & primitives | `public/css/theme-vars.css`, `site-design-system.css` |
| 3 | Header & navigation | `views/public/partials/header.ejs`, `site-modern.css`, `site.js` |
| 4 | Hero carousel | `hero-carousel.ejs`, `hero-fallback.ejs` |
| 5 | Homepage widgets | `views/public/widgets/*`, `widget-header.ejs`, `section-head.ejs` |
| 6 | Blog, archive, search | `page-header.ejs`, `blog.ejs`, `archive.ejs`, `search.ejs`, `site-pages.css` |
| 7 | Single post | `post.ejs`, `post-toolbar.ejs`, reading progress, comments styling |
| 8 | Footer | `footer.ejs` social icons, footer polish in `site-pages.css` |
| 9 | Contact page | `contact.ejs` with widget panels and focus states |
| 10 | Static pages | `page.ejs` with `ds-prose` content panel |
| 11 | Customizer design tokens | `customize.ejs`, `customizer.js`, `np-design-tokens` block |
| 12 | JS micro-interactions | Copy link, share, print, comment reply, reading progress |
| 13 | Accessibility | Skip link, `:focus-visible`, ARIA on search/toolbars |
| 14 | Performance | Lazy/async images, hero `fetchpriority` on post featured images |
| 15 | Dark mode | `theme-dark` body class and overrides in `site-pages.css` |
| 16 | Tests | `tests/publicUi.test.js` |
| 17 | Documentation | This file |

## Managed CSS blocks

The theme customizer stores three managed blocks in **Additional CSS**:

1. `/* np-theme-vars */` — link, button, accent, card, footer, muted colors
2. `/* np-design-tokens */` — radius, shadow, and section spacing presets
3. `/* np-portal-config */` — portal header, nav, and homepage toggles (JSON)

`utils/portalConfig.js` parses and strips these blocks via `stripManagedBlocks()`.

## Design token presets

| Control | Options |
| --- | --- |
| Corner radius | compact, default, rounded |
| Card shadow | none, soft, medium, strong |
| Section spacing | compact, default, spacious |

## Shared partials

- `page-header.ejs` — breadcrumb, title, optional subtitle for inner pages
- `post-toolbar.ejs` — copy link, share, print actions on single posts
- `section-head.ejs` — section titles with optional “view all” link

## Verification

```bash
npm test -- tests/publicUi.test.js
npm test -- tests/portal.test.js tests/widgets.test.js
```

Manual checks:

1. Visit `/blog`, `/search?q=test`, `/contact`, and a single post
2. Open **Appearance → Customize** and change design token presets
3. Enable dark mode and confirm list panels and widgets adapt
4. Use post toolbar: copy link, share (or clipboard fallback), print
