# Testing Guide

## Quick start

```bash
npm ci
npm run test          # all tests, no coverage
npm run test:ci       # CI mode + coverage thresholds
npm run test:coverage # local coverage report
node scripts/coverage-summary.js
```

Tests use `NODE_ENV=test` and database `nodepress_cms_test` (see `TEST_DB_*` in `.env.example`).

## Global setup

`tests/globalSetup.js` runs before Jest:

1. `database/bootstrapTestDatabase.js` — fresh test DB from Sequelize models
2. `database/seed.js` — default users, roles, sample content

Default admin: `admin@example.com` / `Admin@12345`

## Test layout

| File | Area |
|------|------|
| `auth.test.js`, `authExtended.test.js`, `authTwoFactor.test.js` | Login, lockout, 2FA |
| `rbac.test.js`, `rbacOwnership.test.js`, `policy.test.js` | Permissions |
| `posts.test.js`, `pages.test.js`, `crudAdmin.test.js` | CRUD |
| `customPostTypes.test.js` | Custom post types (admin → public → API) |
| `customFields.test.js` | Field groups, validation, public render |
| `revisionsAutosave.test.js` | Revision history, restore, autosave API |
| `templatesFse.test.js` | Site templates / block JSON editor |
| `importExport.integration.test.js` | Export, import, dry-run, CLI export |
| `networkMultisite.test.js` | Multisite flag, network admin, site resolver |
| `cli.test.js` | `bin/nodepress` commands |
| `wordpressFeatures.test.js` | Widgets, comments, health, blocks |
| `media.test.js`, `uploads*.test.js`, `zipUpload.test.js` | Uploads |
| `plugins*.test.js`, `hookManager.test.js` | Plugins |
| `themes*.test.js`, `themePreview.test.js`, `themeManager.test.js` | Themes |
| `waf.test.js`, `wafAdmin.test.js`, `securityAdmin.test.js` | Security / WAF |
| `health.test.js`, `api.test.js`, `deployment.test.js` | Ops |
| `portal*.test.js`, `widgets.test.js`, `translation.test.js` | Portal |

## Coverage thresholds

Configured in `jest.config.js`:

| Metric | Minimum |
|--------|---------|
| Lines | 73% |
| Statements | 70% |
| Functions | 75% |
| Branches | 55% |

Excluded from collection (infra / hard to unit-test): `middleware/waf.js`, `databaseBackup.js`, `translationEngine.js`, `contentTranslator.js`.

## CI

GitHub Actions (`.github/workflows/ci.yml`):

- `lint` — ESLint
- `test` — MySQL 8 service + `npm run test:ci`
- `audit` — `npm audit --audit-level=high`
- `docker` — compose smoke test (`/health`, `/ready`)

## Writing tests

- Use `supertest` with `request.agent(app)` for session cookies
- `tests/helpers.js` — `login()`, `getCsrf()`, `ensurePortalTheme()`
- ZIP fixtures: `tests/helpers/zipFixtures.js`
- Run single file: `npm test -- tests/wafAdmin.test.js`

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ER_TOO_MANY_KEYS` on dev DB | Use `npm run test:ci` (bootstraps test DB); avoid `sync({ alter: true })` on production DB |
| `adm-zip` missing | `npm ci` (package is a dependency) |
| Port 3000 in use | Stop `npm run dev` before tests that bind the app |

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
