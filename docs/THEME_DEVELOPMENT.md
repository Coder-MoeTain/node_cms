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

## Testing

`tests/themes.test.js`, `tests/themesUpload.test.js`, `tests/themePreview.test.js`, `tests/themeManager.test.js`.

See [TESTING.md](./TESTING.md).
