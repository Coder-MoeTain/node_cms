# Changelog

All notable changes to NodePress CMS are documented here.

## [1.2.0] — 2026-06-27

### Added
- Multisite `site_id` scoping (migrations 022–024)
- WordPress WXR round-trip (menus, CPT, field groups) + CSV import/export
- JWT API scopes, `_embed`, admin content search (Ctrl+K)
- 22 block types, block patterns, reusable blocks (save from editor)
- Plugin marketplace catalog UI
- Media **Used in** list on attachment edit screen
- `docs/COMMERCIAL_SCORECARD.md` evidence table

### Testing
- 604+ integration tests across 101 suites; `npm run test:ci` green

## [1.1.0] — 2026-06-25

### Security
- 2FA recovery codes (generate on enable, one-time use, cleared on disable)
- Session ID rotation after successful login
- Invalidate outstanding password-reset tokens when password changes
- Custom CSRF middleware (no deprecated `csurf`)

### Operations
- `GET /version` endpoint (name, version, Node.js, environment)

### Testing
- Dedicated CSRF, health/version, and 2FA recovery test suites
- Isolated 2FA test users to reduce shared-state flakes
- 318+ integration tests; CI thresholds aligned to ~75% line coverage

### Documentation
- `docs/COMMERCIAL_READINESS.md` — audit and score table
- `docs/INSTALLATION.md`, `docs/ADMIN_GUIDE.md`, `docs/USER_GUIDE.md`
- Workflow proof assets and README badges updated

## [1.0.0] — 2026-06

### Added
- WordPress-inspired CMS on Express + MySQL + Sequelize + EJS
- Admin panel: posts, pages, media, menus, themes, plugins, users, roles, security
- Custom post types, custom fields, revisions, autosave
- Block editor foundation and site templates (FSE-lite)
- REST API v1, widgets, shortcodes, comments
- WAF, RBAC, 2FA TOTP, account lockout
- Import/export JSON, optional multisite, CLI
- Docker, PM2, GitHub Actions CI
