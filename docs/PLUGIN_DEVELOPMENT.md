# Plugin Development

NodePress plugins are Node.js modules loaded from `plugins/<slug>/`.

## Directory layout

```text
plugins/my-plugin/
  plugin.json       Required manifest
  index.js          Entry (default main)
  migrations/       Optional SQL migrations
  README.md         Optional
```

## Manifest (`plugin.json`)

```json
{
  "name": "My Plugin",
  "slug": "my-plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "What it does",
  "main": "index.js",
  "settings": [
    { "key": "enabled", "label": "Enabled", "type": "checkbox", "default": "true" }
  ],
  "hooks": ["publicFooter"]
}
```

Required fields: `name`, `slug`, `version`. Slug must be lowercase alphanumeric + hyphens.

## Entry module (`index.js`)

```javascript
module.exports = {
  register({ hooks, manifest }) {
    hooks.register('publicFooter', () => '<!-- my-plugin -->', 10);
  },
  onInstall({ app }) {},
  onActivate({ app }) {},
  onDeactivate({ app }) {},
  onUninstall({ app }) {}
};
```

## Hooks

| Type | Usage |
|------|--------|
| `hooks.register(name, fn, priority)` | Output hook (e.g. `publicFooter`, widgets) |
| `hooks.addFilter(name, fn, priority)` | Transform data |
| `hooks.addAction(name, fn, priority)` | Side effects |

Use `pluginLoader.listRegisteredHooks()` in admin to debug registration.

## Settings

Define `settings` in manifest. Values stored in `plugin_settings`. Access via admin **Plugins → Settings** or `resolvePluginSettings()` in code.

## Migrations

Place `.sql` files in `migrations/`, run via:

- Admin: **Plugins → Details → Run migrations**
- CLI: after install, `pluginLoader.runPluginMigrations('my-plugin')`
- HTTP: `POST /admin/plugins/:slug/migrate`

Migrations are tracked in `plugin_migrations`.

## Packaging

Zip the plugin folder contents (or folder root with `plugin.json` at top level). Upload via **Plugins → Install Plugin**. Max size: 25 MB (see `utils/packageArchive.js`).

## Built-in plugins

| Slug | Purpose |
|------|---------|
| seo-booster | Meta tags, Open Graph |
| analytics-lite | Analytics snippet injection |
| security-monitor | Security event hooks |
| portal-widgets-extension | Extra portal widgets |
| cookie-notice | Cookie consent banner |
| redirection | URL redirects |
| social-share | Share buttons |
| super-cache | Page cache headers |
| updraft-backup | Backup helpers |
| smush-optimizer | Image optimization on upload |
| akismet-shield | Comment spam scoring |

## Testing

See [TESTING.md](./TESTING.md). Integration tests: `tests/plugins.test.js`, `tests/pluginsAdmin.test.js`, `tests/pluginsMigrations.test.js`.
