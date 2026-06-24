# NodePress CMS Upgrade Analysis

Repository: `https://github.com/Coder-MoeTain/node_cms`

This document summarizes the current project structure, the implemented CMS upgrades, remaining risks, and the exact files changed or added to transform the project into a WordPress-like CMS.

## Maturity Assessment

| Stage | Level | Description |
| --- | --- | --- |
| Original/basic CMS | `3/10 - 5/10` | A usable Node.js content app, but missing deep CMS architecture, permissions, theme depth, plugin extensibility, and production hardening. |
| Current upgraded target | `8/10 - 9/10` | A strong WordPress-like CMS foundation with secure admin, post/page/media management, themes, menus, sliders, banners, settings, security tools, and RBAC scaffolding. |
| Professional WordPress-like CMS | `10/10` | Requires a formal plugin architecture, complete theme engine, deeper RBAC policy enforcement, automated tests, audit-grade security, workflow automation, and production deployment operations. |

### Requirements to Reach 10/10

- Plugin architecture with install/activate/deactivate hooks, plugin manifests, permissions, migrations, and isolated admin pages.
- Full theme engine with template discovery, theme manifests, child themes, block/section rendering, asset pipeline, and safe theme uploads.
- Complete RBAC with resource ownership policies, per-action checks, UI-level permission hiding, API-level enforcement, and permission tests.
- Stronger security with maintained CSRF strategy, CSP tuning, password reset email tokens, optional 2FA, audit trails, dependency scanning, and security headers tested in production mode.
- Production-grade media handling with image processing, thumbnails, virus scanning hooks, private media options, CDN support, and cleanup jobs.
- Automated test suite for auth, posts, uploads, permissions, public pages, and admin workflows.
- Operational readiness with PM2 ecosystem config, backups, migrations, structured logs, health checks, and CI/CD.

## 1. Current Project Structure

```text
config/              App and Sequelize/MySQL configuration
controllers/         Admin and public MVC controllers
database/            schema.sql, seed.sql, db sync and seed scripts
docs/                README assets and upgrade analysis
middleware/          Authentication, permission, upload, security, site context, errors
models/              Sequelize models and associations
public/              CSS, JavaScript, and uploaded media
routes/              Admin, public, and API route definitions
utils/               Slug, file, SEO, and pagination helpers
views/               EJS admin, public, theme, and error views
server.js            Express application entry point
```

## 2. Current Database Tables

The CMS schema is defined in `database/schema.sql` and mirrored by Sequelize models in `models/`.

Implemented tables:

- `users`
- `roles`
- `permissions`
- `role_permissions`
- `posts`
- `pages`
- `categories`
- `tags`
- `post_tags`
- `media`
- `menus`
- `menu_items`
- `banners`
- `sliders`
- `themes`
- `theme_settings`
- `site_settings`
- `comments`
- `contact_messages`
- `security_settings`
- `login_attempts`
- `blocked_ips`
- `activity_logs`

Notes:

- Required tables are present.
- Extra support tables `theme_settings`, `security_settings`, and `blocked_ips` were added because they make theme/security management practical.
- Tables include timestamps, soft deletes via Sequelize paranoid models, indexes, and foreign keys where appropriate.

## 3. Existing Routes

### Public Routes

Defined in `routes/public.js`:

- `GET /`
- `GET /blog`
- `GET /post/:slug`
- `GET /category/:slug`
- `GET /tag/:slug`
- `GET /page/:slug`
- `GET /search`
- `GET /contact`
- `POST /contact`
- `POST /post/:id/comment`
- `GET /sitemap.xml`
- `GET /robots.txt`

### Admin Routes

Defined in `routes/admin.js`:

- `GET /admin`
- `GET|POST /admin/login`
- `POST /admin/logout`
- `GET|POST /admin/forgot-password`
- `GET|POST /admin/reset-password`
- `GET|PUT /admin/profile`
- `GET|POST|PUT|DELETE /admin/posts`
- `GET|POST|PUT|DELETE /admin/pages`
- `GET|POST|PUT|DELETE /admin/categories`
- `GET|POST|PUT|DELETE /admin/tags`
- `GET|POST|PUT|DELETE /admin/comments`
- `GET|POST|PUT|DELETE /admin/messages`
- `GET /admin/media`
- `POST /admin/media/upload`
- `DELETE /admin/media/:id`
- `GET|POST|PUT|DELETE /admin/users`
- `GET|POST|PUT|DELETE /admin/roles`
- `GET|POST|PUT|DELETE /admin/menus`
- `GET|POST|PUT|DELETE /admin/menu-items`
- `GET|POST|PUT|DELETE /admin/banners`
- `GET|POST|PUT|DELETE /admin/sliders`
- `GET /admin/themes`
- `POST /admin/themes/activate`
- `PUT /admin/theme-settings`
- `GET /admin/settings`
- `PUT /admin/settings`
- `GET /admin/security`
- `PUT /admin/security/settings`
- `POST /admin/security/block-ip`
- `DELETE /admin/security/unblock-ip/:id`

### API Routes

Defined in `routes/api.js`:

- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /api/pages/:slug`
- `GET /api/categories`

## 4. Security Weaknesses Found and Fixed

Fixed:

- Added bcrypt password hashing in `controllers/admin/authController.js`.
- Added `express-session` backed by Sequelize session storage in `server.js`.
- Protected admin routes through `middleware/auth.js`.
- Added permission checks through `middleware/permission.js`.
- Added Helmet, CORS, rate limiting, blocked IP checks, and upload constraints.
- Added CSRF protection globally through `csurf`.
- Added login attempt logging through `models/LoginAttempt.js`.
- Added admin activity logs through `models/ActivityLog.js`.
- Added MIME and extension validation for uploaded files in `middleware/upload.js`.
- Added rich text sanitization in `controllers/admin/crudController.js`.
- Moved TinyMCE away from `no-api-key` cloud read-only mode to self-hosted TinyMCE.

Remaining production recommendations:

- Replace `SESSION_SECRET` before deployment.
- Use HTTPS and secure reverse proxy headers.
- Configure real email delivery for forgot/reset password flows.
- Consider replacing archived `csurf` with a maintained CSRF strategy before long-term production use.
- Add automated tests for auth, permissions, uploads, and publishing workflows.

## 5. Missing CMS Features Identified and Added

Added:

- Admin authentication and protected dashboard.
- Roles, permissions, and permission middleware.
- Post CRUD with status, slug, category, tags, SEO, featured image, video URL, publish date, and comments.
- Page CRUD with slug, status, and SEO fields.
- Category and tag management.
- Media library with upload, delete, URL copy, MIME checks, file size limits, and safe names.
- Dynamic menus with parent-child support and header/footer locations.
- Banner and slider management.
- Theme settings with active theme, logo, favicon, colors, layout, sidebar position, dark mode.
- Site settings with branding, contact details, social links, defaults, and maintenance mode.
- Security admin page with login attempts, blocked IPs, security settings, and activity logs.
- Public frontend for home, blog, post, category, tag, page, search, contact, sitemap, and robots.
- Modern responsive public and admin UI.
- Flag-only translation buttons for Myanmar, Chinese, English, and Russian.
- GitHub-style README with local SVG preview images.

## 6. Code Quality Issues Found and Fixed

Fixed:

- Introduced MVC folders instead of placing all logic in one file.
- Added Sequelize models with table names and associations.
- Added reusable CRUD controller for repeated admin resources.
- Added shared pagination and slug utilities.
- Added `siteContext` middleware for menus, settings, theme, recent posts, popular posts, and categories.
- Added error handler for API and HTML responses.
- Added `.env.example`.
- Added README and this upgrade analysis document.

Remaining improvements:

- Split generic CRUD controller into resource-specific controllers once business rules grow.
- Add request validation coverage for all admin resources, not only login/contact.
- Add test suite and CI workflow.
- Add real password reset email adapter.

## 7. Deployment Issues Found and Fixed

Fixed:

- Added `README.md` deployment guide for Ubuntu, Nginx, PM2, and HTTPS.
- Added `.env.example`.
- Added `npm run db:sync` and `npm run seed` scripts.
- Added upload directory placeholder at `public/uploads/.gitkeep`.

Remaining production tasks:

- Configure PM2 ecosystem file if multiple environments are needed.
- Configure backup jobs for MySQL and `public/uploads`.
- Configure Nginx upload limits if large media files are expected.

## 8. Exact File-by-File Fixes

### Root

- `package.json`: Added dependencies and scripts for Express, Sequelize, MySQL, sessions, security, uploads, TinyMCE, and development.
- `server.js`: Configured Express app, sessions, static assets, TinyMCE vendor serving, CSRF, routes, site context, maintenance mode, and errors.
- `.env.example`: Added sample environment variables.
- `README.md`: Rewritten as a professional GitHub-style README.

### Config

- `config/app.js`: Central app configuration from environment variables.
- `config/database.js`: Sequelize MySQL connection and model defaults.

### Database

- `database/schema.sql`: Full MySQL CMS schema with keys, indexes, foreign keys, timestamps, and soft delete columns.
- `database/seed.sql`: Manual SQL seed for roles, permissions, settings, pages, menus, banners, sliders, themes, and security settings.
- `database/sync.js`: Sequelize sync helper.
- `database/seed.js`: Runtime seed script with bcrypt admin account and default CMS data.

### Models

- `models/User.js`: Admin/user account model.
- `models/Role.js`: Role model.
- `models/Permission.js`: Permission model.
- `models/Post.js`: Blog post model.
- `models/Page.js`: Static page model.
- `models/Category.js`: Nested category model.
- `models/Tag.js`: Tag model.
- `models/Media.js`: Uploaded file metadata model.
- `models/Menu.js`: Menu model.
- `models/MenuItem.js`: Nested menu item model.
- `models/Banner.js`: Banner model.
- `models/Slider.js`: Slider model.
- `models/Theme.js`: Theme model.
- `models/ThemeSetting.js`: Theme customization model.
- `models/SiteSetting.js`: Site settings model.
- `models/Comment.js`: Comment moderation model.
- `models/ContactMessage.js`: Contact form message model.
- `models/SecuritySetting.js`: Security settings model.
- `models/LoginAttempt.js`: Login attempt logging.
- `models/BlockedIp.js`: IP blocking model.
- `models/ActivityLog.js`: Admin activity logging.
- `models/index.js`: Associations and model exports.

### Middleware

- `middleware/auth.js`: Session auth and timeout protection.
- `middleware/permission.js`: Permission middleware.
- `middleware/upload.js`: Multer storage, MIME checks, size limits, blocked extensions.
- `middleware/security.js`: Helmet, CORS, rate limits, blocked IP checks.
- `middleware/siteContext.js`: Loads settings, theme, menus, widgets, recent/popular posts.
- `middleware/errorHandler.js`: API/HTML error responses.

### Controllers

- `controllers/admin/authController.js`: Login, logout, profile, password update, reset placeholders.
- `controllers/admin/dashboardController.js`: Dashboard stats and recent activity.
- `controllers/admin/crudController.js`: Posts, pages, categories, tags, users, roles, menus, banners, sliders, comments, messages.
- `controllers/admin/mediaController.js`: Media upload, list, delete.
- `controllers/admin/settingsController.js`: Site settings and theme management.
- `controllers/admin/securityController.js`: Security settings, login attempts, blocked IPs, activity logs.
- `controllers/public/siteController.js`: Public website pages, archives, search, comments, contact, sitemap, robots.

### Routes

- `routes/admin.js`: Admin auth, dashboard, resources, media, settings, themes, security.
- `routes/public.js`: Public website routes.
- `routes/api.js`: Basic JSON API routes.

### Views

- `views/admin/*`: Admin login, profile, dashboard, CRUD forms/lists, media, settings, themes, security, partials.
- `views/public/*`: Public home, blog, post, page, archive, search, contact, and partials.
- `views/errors/*`: 404, 500, maintenance pages.
- `views/themes/*`: Built-in theme placeholders.

### Public Assets

- `public/css/admin.css`: Professional admin UI system.
- `public/css/site.css`: Public space-agency inspired theme and responsive layout.
- `public/js/admin.js`: TinyMCE init, confirmations, previews, theme/sidebar toggles.
- `public/js/site.js`: Lazy images and language flag translation behavior.
- `public/uploads/.gitkeep`: Keeps upload directory in git.

### Documentation Assets

- `docs/assets/nodepress-cover.svg`: README cover image.
- `docs/assets/public-preview.svg`: Public frontend preview.
- `docs/assets/admin-preview.svg`: Admin dashboard preview.
- `docs/UPGRADE_ANALYSIS.md`: This analysis and implementation report.

## 9. Default Admin

Created by `npm run seed`:

```text
Email: admin@example.com
Password: Admin@12345
Role: Super Admin
```

The account is marked for password change after first login.

## 10. Run Commands

```bash
npm install
npm run db:sync
npm run seed
npm run dev
```

Open:

- Public: `http://localhost:3000`
- Admin: `http://localhost:3000/admin/login`
