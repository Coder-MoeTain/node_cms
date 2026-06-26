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

Required fields: `name`, `slug`, `version`, `main` (optional, defaults to `index.js`). Slug must be lowercase kebab-case. Version must be valid semver.

Optional fields: `nodepressVersion`, `dependencies`, `permissions`, `settings` (array or object schema), `hooks`, `license`, `updateUrl`, `changelogUrl`.

Validation is enforced by `utils/pluginValidator.js` on activation and install.

## Plugin manager API

Use `utils/pluginManager.js` (facade over `pluginLoader.js`):

- `discoverPlugins()`, `getPlugin(slug)`, `validatePlugin(slug)`
- `activatePlugin(slug, app, user)`, `deactivatePlugin`, `uninstallPlugin(slug, app, user, options)`
- `loadActivePlugins(app)`, `reloadPlugin(slug, app)`
- `getPluginSettings(slug)`, `savePluginSettings(slug, settings, user)`
- `runPluginMigrations(slug)`, `getPluginHealth(slug)`
- `registerPluginRoutes(app)`, `registerPluginAssets(app)` — called automatically on load

Set `PLUGIN_SAFE_MODE=true` to skip loading all plugins (site stays up; admin shows warning).

## Hooks (WordPress-style)

| API | Purpose |
|-----|---------|
| `hooks.register(name, fn, priority)` | Collector hooks (`publicFooter`, `adminMenuItems`, …) |
| `hooks.addFilter(name, fn, priority)` | Transform values |
| `hooks.addAction(name, fn, priority)` | Side effects |
| `hooks.removeFilter` / `hooks.removeAction` | Unregister |

Core hook names include `public:head`, `post:beforeRender`, `media:beforeUpload`, `admin:menu`, `waf:beforeCheck`, and legacy aliases (`publicHead`, `beforePageRender`, …).

Hook callbacks are error-isolated — a failing plugin hook does not crash the CMS.

## Entry module (`index.js`)

```javascript
module.exports = {
  register({ hooks, manifest, app }) {
    hooks.register('publicFooter', () => '<!-- my-plugin -->', 10);
  },
  onInstall({ app }) {},
  onActivate({ app }) {},
  onDeactivate({ app }) {},
  onUninstall({ app }) {}
};
```

## Settings & migrations

Define `settings` in manifest (array or object schema). Values stored in `plugin_settings`. SQL migrations go in `migrations/*.sql` and are tracked in `plugin_migrations`.

## Permissions

Declare `"permissions": ["manage_plugins"]` in `plugin.json`. Only known RBAC slugs are accepted (see `pluginValidator.KNOWN_PERMISSIONS`).

## Public / admin assets

Place files under `plugins/<slug>/public/` (or `assets/`). Served at `/plugins/<slug>/public/...` when active.

## Routes

In `register()`, use `hooks.registerRoute('GET', '/admin/my-plugin/page', handler, { admin: true })` to register plugin routes (wrapped with error isolation).

## Audit logging

Plugin admin actions are logged via `activityLogHelper.logPluginAudit` with actions like `plugin.installed`, `plugin.activated`, `plugin.settings_updated`.

## Security

ZIP uploads are quarantined under `tmp/quarantine/`, scanned for Zip Slip, symlinks, dangerous extensions (`.php`, `.env`, `.pem`, `.key`, …), and size limits. See [SECURITY.md](./SECURITY.md).

## Testing

See [TESTING.md](./TESTING.md). Integration tests: `tests/plugins.test.js`, `tests/pluginsAdmin.test.js`, `tests/pluginsMigrations.test.js`, `tests/pluginThemeCommercial.test.js`.
