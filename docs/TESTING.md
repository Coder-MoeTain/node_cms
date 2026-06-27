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
| `adminTaxonomyWidgetsTranslation.test.js` | Taxonomies, widgets, translate-content API |
| `adminCustomContentRevision.test.js` | Custom content CRUD, field groups, revision compare/restore |
| `adminCrudImportExport.test.js` | CRUD bulk/trash, CPT admin, import/export UI |
| `adminCrudMenusUsers.test.js` | Menus, users, bulk category/author, messages, banners |
| `adminCrudRolesSliders.test.js` | Roles/permissions CRUD, sliders CRUD, bulk edge cases |
| `wxrImport.test.js` | WordPress WXR parse, preview, import, admin upload |
| `wxrExport.test.js` | WXR XML generation and round-trip parse |
| `wxrMediaDownloader.test.js` | SSRF-safe remote media download + WXR export route |
| `loop11Commercial.test.js` | CSV import/export, block patterns, public content renderer |
| `loop12Commercial.test.js` | Media used-in list, reusable blocks persistence |
| `fsePublicHelper.test.js` | FSE public template loading and locals merge |
| `loop13Commercial.test.js` | Autosave, CPT `_embed`, reusable HTTP API, plugin tabs, child ZIP, archive layout, analytics migration |
| `fsePublicRoutes.test.js` | Public HTTP routes render active FSE templates |
| `revisionsAdminUi.test.js` | Revision compare UI, post edit link, page block restore |
| `jwtToken.test.js` | JWT sign/verify and API scopes |
| `adminSearchApi.test.js` | Admin live content search API |
| `marketplace.test.js` | Plugin marketplace catalog |
| `customPostTypes.test.js` | Custom post types (admin → public → API) |
| `customFields.test.js` | Field groups, validation, public render |
| `revisionsAutosave.test.js` | Revision history, restore, autosave API |
| `templatesFse.test.js` | Site templates / block JSON editor |
| `importExport.integration.test.js` | Export, import, dry-run, CLI export |
| `networkMultisite.test.js` | Multisite flag, network admin, site resolver, per-site settings |
| `multisiteSiteScope.test.js` | Content isolation by `site_id`, network branding overlay, admin settings UI |
| `multisiteApiScope.test.js` | API v1 types/tags/posts scoped by network site domain |
| `siteScope.test.js` | Multisite scope helper unit tests |
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
