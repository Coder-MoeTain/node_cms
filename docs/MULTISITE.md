# Multisite (optional)

Multisite is **disabled by default**. Enable with:

```env
MULTISITE_ENABLED=true
```

## Features

- Network sites table (`sites`, `site_domains`, `site_users`, `network_site_settings`)
- Super Admin network dashboard at `/admin/network`
- Site resolution middleware (`middleware/siteResolver.js`) attaches `res.locals.currentSite`
- Content scoping via `site_id` on posts, pages, media, menus, widgets, and related tables (migrations `022`–`024`)
- `utils/siteScope.js` helpers: `siteScopeWhere()`, `assignSiteScope()`, `resolveSiteId()`

## Content isolation

When multisite is enabled:

- New content created in a site context receives that site's `site_id`
- Queries use `siteScopeWhere()` which returns rows matching the current site **or** legacy rows where `site_id IS NULL` (shared/global content from pre-multisite installs)

This soft isolation keeps existing single-site data visible on all network sites during migration. For strict per-site-only content, backfill `site_id` on legacy rows and tighten scope rules in `utils/siteScope.js`.

## Network admin

- `/admin/network` — site list and network settings (requires network super-admin)
- `/admin/network/sites` — create and manage sites

## API

REST v1 routes respect `siteScopeWhere()` when `MULTISITE_ENABLED=true` and a site is resolved from the request host/path.

## Testing

- `tests/networkMultisite.test.js` — network routes and site CRUD
- `tests/multisiteSiteScope.test.js` — `site_id` scoping behavior
- `tests/multisiteApiScope.test.js` — API isolation

Enable multisite in test env to exercise network CRUD end-to-end.
