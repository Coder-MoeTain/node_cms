# NodePress CMS Architecture

## Overview

NodePress CMS is a monolithic Node.js application: Express handles HTTP, Sequelize maps to MySQL, EJS renders views, and optional plugins/themes extend behavior without forking core code.

## Layered structure

```text
server.js
  ├── middleware/     Security, CSRF, WAF, auth, site context, uploads
  ├── routes/         public.js, admin.js, api.js, health.js
  ├── controllers/    Thin handlers (admin + public)
  ├── models/         Sequelize models + associations
  ├── utils/          Theme engine, plugin loader, hooks, WAF helpers
  ├── views/          EJS layouts and partials
  ├── themes/         Installable theme packages (theme.json + templates)
  └── plugins/        Installable plugin packages (plugin.json + hooks)
```

## Request flow (public)

1. Helmet, CORS, rate limits, blocked IP check
2. Static assets (bypass WAF)
3. Body parsing, session, CSRF, locale, site context
4. WAF inspection (monitor or block)
5. `routes/public.js` → `siteController`
6. Theme loader resolves active theme template chain
7. Plugin hooks inject widgets, footer snippets, etc.

## Request flow (admin)

1. Same security stack through WAF
2. `routes/admin.js` with `requireAuth` + `can()` permission middleware
3. Controllers mutate models, flash messages, redirect (PRG pattern)
4. Activity log middleware records sensitive actions

## Data layer

- **MySQL** with utf8mb4
- **Sequelize** models use underscored columns, soft deletes (`paranoid`)
- **Migrations** in `database/migrations/*.sql` tracked in `migrations` table
- **Test DB** bootstrapped via `database/bootstrapTestDatabase.js` (drop/create + `sync`)

## Plugin architecture

- Discovery: scan `plugins/*/plugin.json`
- Lifecycle: `onInstall`, `onActivate`, `onDeactivate`, `onUninstall`
- Hooks: `hookManager` (actions + filters), registered in `register()`
- Migrations: `plugins/<slug>/migrations/*.sql` via `pluginLoader.runPluginMigrations`
- Admin: upload ZIP, activate, settings, run migrations

See [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md).

## Theme architecture

- Discovery: scan `themes/*/theme.json`
- Parent/child inheritance via `parent` in manifest
- Template chain: child → parent → public fallbacks
- Activation updates `themes` + `theme_settings` tables
- Customizer stores draft in session for live preview

See [THEME_DEVELOPMENT.md](./THEME_DEVELOPMENT.md).

## Security architecture

- Session store: MySQL (`sessions` table)
- RBAC: roles ↔ permissions, `middleware/permission.js`
- Resource policies: `utils/policy.js` (ownership for authors)
- WAF: `middleware/waf.js` + admin UI (`wafController`)
- See [SECURITY.md](./SECURITY.md)

## Configuration

- `config/app.js` — env-driven app settings
- `config/database.js` — Sequelize connection (`TEST_DB_*` when `NODE_ENV=test`)
- `.env` — secrets and DB credentials (never commit)

## Related docs

- [API.md](./API.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [TESTING.md](./TESTING.md)
