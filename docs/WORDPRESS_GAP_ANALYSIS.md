# WordPress Function Gap Analysis — NodePress CMS

**Updated:** June 2026 · **Version:** 1.1.0+  
**Architecture:** Express + Sequelize + MySQL + EJS

## 1. Implemented WordPress-like features (10/10 parity for NodePress scope)

| Area | NodePress status |
|------|------------------|
| **Posts & pages** | Full lifecycle: draft, pending, private, scheduled, trash, restore, revisions, autosave, SEO, preview, bulk actions |
| **Categories & tags** | Hierarchical categories, tags, archives, SEO metadata, post counts |
| **Custom post types** | Admin-created types, archives, singles, permissions, REST API |
| **Custom fields** | Field groups (ACF-like), validation, repeater/group, API exposure |
| **Block editor** | 22 block types, patterns, reusable blocks, safe JSON render |
| **Full Site Editing** | Site templates, template parts, preview (FSE-lite) |
| **Media library** | Upload, variants, metadata, regenerate thumbnails, **used-in list** |
| **Menus** | Nested items, theme locations, public + mobile render |
| **Widgets** | Widget areas, instances, ordering, admin + public render |
| **Comments** | Threading UI, moderation (approve/spam/trash), admin reply, Gravatar |
| **REST API v1** | CRUD, pagination, search, JWT scopes, `_embed` |
| **Multisite** | Optional network mode, `site_id` isolation, network admin |
| **Import/export** | JSON, CSV, WordPress WXR (menus, CPT, field groups), dry-run |
| **Shortcodes** | `[button]`, `[recent_posts]`, `[contact_form]`, `[gallery]`, etc. |
| **Security** | CSRF, 2FA + recovery, WAF, lockout, SSRF-safe import |
| **CLI** | `bin/nodepress` — migrate, seed, export, publish scheduled |
| **Tests & CI** | 616+ tests, coverage thresholds, GitHub Actions |

## 2. Optional enhancements (not required for NodePress 10/10)

| Feature | Notes |
|---------|-------|
| Hosted plugin marketplace | Bundled catalog exists; no paid store |
| OAuth2/OIDC provider | JWT scoped tokens implemented |
| Elasticsearch | SQL LIKE search works |
| GraphQL | REST v1 is primary API |
| Full Gutenberg React editor | Lightweight block toolbar editor (feature parity via blocks) |

## 3. Verification

```bash
npm run test:ci
npm run migrate
npm run predeploy
```

See [`COMMERCIAL_SCORECARD.md`](COMMERCIAL_SCORECARD.md) for per-area evidence.
