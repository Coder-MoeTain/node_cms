# Theme Development

Themes live in `themes/<slug>/` and override public templates via EJS.

## Directory layout

```text
themes/my-theme/
  theme.json
  screenshot.png or screenshot.svg (optional)
  templates/
    home.ejs
    blog.ejs
    post.ejs
    page.ejs
    search.ejs
    contact.ejs
  assets/          Optional CSS/JS
  partials/        Optional overrides
```

## Manifest (`theme.json`)

```json
{
  "name": "My Theme",
  "slug": "my-theme",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "Theme description",
  "parent": "classic-blog",
  "templates": ["home", "blog", "post", "page", "search", "contact"]
}
```

`parent` is optional for child themes. Parent must be installed first.

## Template resolution

1. Active theme `templates/<name>.ejs`
2. Parent chain (if child theme)
3. `views/public/<name>.ejs` fallback

Required templates: `home`, `blog`, `post`, `page`, `search`, `contact`.

## Child themes

Set `parent` to an installed theme slug. Child inherits missing templates from parent. Uninstall order: child first, then parent.

## Activation

Admin **Themes → Activate** or `themeManager.activateTheme(id)`. Updates `themes.active` and `theme_settings`.

## Customizer

- **Themes → Customize** edits colors, layout, custom CSS/JS
- **Preview** stores draft in session (`POST /admin/theme-settings/preview`)
- **Live preview** opens public site with `?customizer_preview=1`
- **Logo options** in Site identity: max height/width (px) and placement (left, center, right, above title)

## Safe uploads

ZIP install scans for blocked extensions (`.php`, `.exe`, etc.). Archives validated via `packageArchive` (path traversal protection, size limits).

## Custom CSS/JS

Stored in `theme_settings.custom_css` / `custom_js`. Managed blocks strip dangerous patterns in admin; public output should remain sanitized.

## Packaging

Zip theme folder; upload via **Themes → Install Theme**. Same 25 MB limit as plugins.

## Bundled themes

classic-blog, modern-news, minimal-personal, myanmar-portal, government-portal, corporate-business, creative-studio, dark-elegant, ecommerce-store, education-campus, magazine-grid.

## Template hierarchy

`utils/templateResolver.js` resolves templates in WordPress-like order (child → parent → public fallback):

| Context | Candidate templates |
|---------|---------------------|
| Front page | `front-page`, `home`, `blog`, `index` |
| Blog index | `blog`, `home`, `index` |
| Single post | `single-{postType}`, `single`, `post`, `index` |
| Page | `page-{slug}`, `page`, `index` |
| Category | `category-{slug}`, `category`, `archive`, … |
| Tag | `tag-{slug}`, `tag`, `archive`, … |
| Search | `search`, `index` |
| 404 | `404`, `error`, `index` |

Pass context to `themeLoader.resolveTemplate(type, { slug, postType, isFrontPage })`.

## Theme manager API

- `utils/themeManager.js` — `discoverThemes`, `validateTheme`, `activateTheme`, `getThemeHealth`
- `utils/themeInstaller.js` — secure ZIP install
- `utils/themeValidator.js` — manifest validation
- `exportThemeSettings(slug)` / `importThemeSettings(slug, json, user)`

## Customizer & presets

Built-in presets include Government Modern, Corporate Blue, News Magazine, Clean Minimal, Dark Elegant, and Myanmar Portal Modern (see **Themes → Customize**).

## Security

Theme ZIP uploads use the same quarantine pipeline as plugins. Theme `.js` files are only allowed under `public/` or `assets/`. See [SECURITY.md](./SECURITY.md).

## Testing

`tests/themes.test.js`, `tests/themesUpload.test.js`, `tests/themePreview.test.js`, `tests/themeManager.test.js`, `tests/pluginThemeCommercial.test.js`.
