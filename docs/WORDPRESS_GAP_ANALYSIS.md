# WordPress Function Gap Analysis — NodePress CMS

This document compares NodePress CMS (Express + Sequelize + MySQL + EJS) with WordPress core capabilities as of v1.0.0, and defines the recommended upgrade path.

## 1. Existing WordPress-like features

| Area | NodePress status |
|------|------------------|
| **Posts & pages** | Full CRUD, drafts/published/private, SEO fields, featured image, TinyMCE editor, author assignment, categories/tags on posts |
| **Categories & tags** | Hierarchical categories, flat tags, many-to-many on posts |
| **Media library** | Upload, variants (Sharp), metadata edit, RBAC |
| **Theme system** | Manifests, child themes, ZIP upload, customizer, theme settings, partial overrides |
| **Plugin system** | Hooks/filters, migrations, activate/deactivate/uninstall, settings |
| **Menus** | Menu + menu items with hierarchy, portal integration |
| **Portal widgets** | Fixed EJS widget includes on homepage (services, news, emergency contacts, etc.) |
| **Comments** | Public submission, admin moderation (pending/approved), linked to posts |
| **REST/API** | Read-only `/api` for posts, pages, categories (API key optional) |
| **Admin editor** | WordPress-style metabox layout, permalink, publish box, SEO box |
| **User roles (RBAC)** | Super Admin, Admin, Editor, Author, Subscriber + granular permissions |
| **Security** | CSRF, WAF, rate limits, 2FA, login brute-force guard, activity log |
| **SEO** | Per-post/page SEO, sitemap.xml, robots.txt |
| **Internationalization** | Locale middleware, translation cache, content translator |
| **Search** | Public full-text search on posts/pages |
| **Backups & DB tools** | Admin backup/restore, scheduled backup script |
| **Import (partial)** | WordPress SQL import script (`database/import-wordpress.js`) |
| **Tests & CI** | 240+ Jest tests, coverage thresholds, GitHub Actions, Docker |
| **Deployment** | PM2, Docker Compose, remote deploy script |

## 2. Missing WordPress-like features

| Feature | WordPress | NodePress (pre-upgrade) |
|---------|-----------|-------------------------|
| Custom Post Types | `register_post_type()` | Not available |
| Custom fields / ACF | Meta boxes, field groups | Not available |
| Block editor (Gutenberg) | Block JSON in post content | TinyMCE only |
| Full Site Editing | Block templates | Theme EJS only |
| Revisions & autosave | `wp_posts` revisions + heartbeat | Not available |
| REST API v1 (full) | CRUD, pagination, `_embed` | Read-only, 4 endpoints |
| Multisite | Network of sites | Single site only |
| Widget areas & registry | `register_sidebar()` | Hardcoded portal widgets |
| Shortcodes | `[gallery]` etc. | Not available |
| Comment threading UI | Nested replies | Flat list (`parent_id` unused in UI) |
| Import/export UI | Tools → Export WXR | SQL import script only |
| Update system | Core/plugin/theme updates | Manual npm/git only |
| Site Health | Tools → Site Health | Health endpoint script only |
| WP-CLI | `wp` command | No unified CLI |
| Scheduled publish cron | `wp-cron` | Status exists, no cron job |
| Custom taxonomies per CPT | `register_taxonomy()` | Global categories/tags only |

## 3. Partially implemented features

| Feature | What exists | Gap |
|---------|-------------|-----|
| **Comments** | DB has `parent_id`, moderation statuses | No threaded UI, spam/trash workflow, reply in admin, Gravatar |
| **API** | Basic GET routes | No v1 namespace, writes, pagination standard, JWT |
| **Widgets** | Portal homepage sections | No admin widget areas, drag-and-drop, sidebar registry |
| **Revisions** | None | — |
| **Search** | Title/content LIKE | No faceted search, CPT scope, relevance ranking |
| **Scheduled posts** | `scheduled` enum value | No background publisher |
| **Import** | WP SQL importer | No WXR, JSON export, dry-run UI |
| **SEO** | Meta fields + sitemap | No schema.org JSON-LD builder, Open Graph per CPT |

## 4. Risk areas

1. **Route conflicts** — CPT archive URLs at root (`/news`) can collide with pages/posts; use prefixed routes (`/types/:slug`) or configurable rewrite base.
2. **Slug uniqueness** — WordPress allows duplicate slugs across post types; global unique slugs on `posts` table require scoping by `post_type`.
3. **Block editor XSS** — HTML/custom blocks must be sanitized; restrict HTML block by permission.
4. **Multisite data isolation** — Requires `site_id` on all content tables; enable only via config flag.
5. **Remote updates** — Never execute arbitrary remote code; version check + manual upgrade only.
6. **Custom field injection** — Validate field types and escape output on public templates.
7. **Migration on live DB** — New columns on `posts` must be backward-compatible (`post_type` default `'post'`).
8. **Test DB bootstrap** — Uses Sequelize `sync()`; models must define all new columns for tests to pass.

## 5. Recommended implementation order

| Phase | Feature | Rationale |
|-------|---------|-----------|
| **1** | Gap analysis (this doc) | Baseline for planning |
| **2** | Custom Post Types | Foundation for portal content types (news, events, jobs…) |
| **3** | Custom fields / meta boxes | Depends on CPT + posts/pages |
| **6** | Revisions & autosave | High editor value, uses existing post payload |
| **7** | REST API v1 | Enables headless and integrations |
| **10** | Widgets & shortcodes | Portal flexibility without full FSE |
| **11** | Comment upgrade | Threading + moderation queues |
| **4** | Block editor foundation | Incremental; keep classic editor |
| **5** | Template builder (FSE-lite) | After blocks stable |
| **9** | Import/export UI | After CPT + fields stable |
| **13** | Site Health & tools | Low risk, high ops value |
| **12** | Update checker | Safe manual updates |
| **14** | CLI (`nodepress`) | Developer/ops ergonomics |
| **8** | Multisite (optional) | Last — largest schema impact |
| **15–17** | Tests, docs, verification | Continuous |

## WordPress-like function score (pre-upgrade)

| Category | Score (0–10) |
|----------|--------------|
| Core content (posts/pages) | 8 |
| Taxonomies | 7 |
| Media | 8 |
| Themes | 8 |
| Plugins | 8 |
| Admin UX | 8 |
| Security | 9 |
| API | 4 |
| CPT & custom fields | 0 |
| Editor (blocks) | 3 |
| Revisions | 0 |
| Widgets/shortcodes | 4 |
| Comments | 5 |
| Multisite | 0 |
| Import/export | 3 |
| CLI/tools | 4 |
| **Overall functional parity** | **~5.5 / 10** |

After Phases 2–3 (+ foundation work), target **~6.5–7 / 10**. Full spec completion targets **~8.5 / 10** (100% parity with WordPress ecosystem is not the goal).

**Updated (Phases 4–14 implemented):** ~**8.0 / 10** functional parity — CPT, custom fields, block editor, revisions/autosave, REST API v1 (read/write), widgets, shortcodes, threaded comments, import/export, updates checker, site health, CLI, optional multisite foundation, FSE-lite templates.

## Related docs

- [CUSTOM_POST_TYPES.md](./CUSTOM_POST_TYPES.md)
- [CUSTOM_FIELDS.md](./CUSTOM_FIELDS.md)
- [API.md](./API.md)
- [UPGRADE_ANALYSIS.md](./UPGRADE_ANALYSIS.md)
