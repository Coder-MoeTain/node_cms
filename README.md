## Production Upgrade Commands

```bash
npm install
npm run db:sync
npm run seed
npm run dev
npm test
```

Production:

```bash
npm ci --omit=dev
npm run migrate
pm2 start ecosystem.config.js
```

Health endpoints:

- `GET /health`
- `GET /ready`

Testing uses a dedicated MySQL database configured with `TEST_DB_*` environment variables. See `.env.example`, `docs/DEPLOYMENT.md`, and `docs/BACKUP_AND_RESTORE.md`.

<p align="center">
  <img src="docs/assets/nodepress-cover.svg" alt="NodePress CMS cover" width="100%">
</p>

<h1 align="center">NodePress CMS</h1>

<p align="center">
  A WordPress-inspired publishing platform built with Node.js, Express, MySQL, Sequelize, EJS, Bootstrap 5, and a modern space-agency inspired interface.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="#highlights">Features</a>
  ·
  <a href="#project-structure">Structure</a>
  ·
  <a href="#deployment">Deployment</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Database-MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL">
  <img src="https://img.shields.io/badge/ORM-Sequelize-52B0E7?style=for-the-badge&logo=sequelize&logoColor=white" alt="Sequelize">
  <img src="https://img.shields.io/badge/UI-Bootstrap_5-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap">
  <img src="https://img.shields.io/badge/License-MIT-black?style=for-the-badge" alt="License">
</p>

---

NodePress CMS is a complete blog and content management system with a public website, admin dashboard, media library, theme settings, role permissions, SEO helpers, security tools, comments, dynamic menus, and flag-only translation controls.

For the repository audit, missing-feature analysis, security review, and exact file-by-file upgrade notes, see [`docs/UPGRADE_ANALYSIS.md`](docs/UPGRADE_ANALYSIS.md). For the step-by-step implementation report and testing checklist, see [`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md).

## Preview

```text
Public Site  -> http://localhost:3000
Admin Panel  -> http://localhost:3000/admin/login
```

<p align="center">
  <img src="docs/assets/public-preview.svg" alt="NodePress public website preview" width="49%">
  <img src="docs/assets/admin-preview.svg" alt="NodePress admin dashboard preview" width="49%">
</p>

## Highlights

| Area | What You Get |
| --- | --- |
| Public Website | Home, blog, post detail, category, tag, search, contact, sitemap, and robots.txt pages |
| Admin Panel | Dashboard, posts, pages, media, menus, banners, sliders, themes, users, roles, settings, and security tools |
| Publishing | Drafts, publishing, private posts, scheduled dates, SEO fields, featured images, video embeds, tags, categories |
| Design System | Space-agency inspired frontend, modern admin dashboard, dynamic logo, favicon, colors, layout, dark mode |
| Media Library | Upload images, videos, PDFs, docs, copy URLs, and reuse assets in posts and pages |
| Security | Sessions, bcrypt, Helmet, CSRF, rate limiting, upload validation, blocked IPs, login attempts, activity logs |
| Internationalization | Flag-only translation buttons for Myanmar, Chinese, English, and Russian |

## Maturity Level

| Stage | Level | Meaning |
| --- | --- | --- |
| Original/Basic CMS | `3/10 - 5/10` | Basic content app with limited CMS depth |
| Current Upgrade Target | `8/10 - 9/10` | WordPress-like CMS foundation with admin, content, media, themes, menus, settings, security, and RBAC |
| Professional WordPress-like CMS | `10/10` | Requires plugin architecture, stronger security hardening, a full theme engine, complete RBAC policy coverage, tests, and production-grade extensibility |

See [`docs/UPGRADE_ANALYSIS.md`](docs/UPGRADE_ANALYSIS.md) for the full upgrade roadmap.

## Visual Experience

NodePress ships with a polished public theme and a matching admin interface.

<p align="center">
  <img src="docs/assets/public-preview.svg" alt="Public website mockup" width="82%">
</p>

The public website uses dynamic menus, hero sliders, banners, blog cards, sidebar widgets, footer menus, logo settings, and translation controls.

<p align="center">
  <img src="docs/assets/admin-preview.svg" alt="Admin dashboard mockup" width="82%">
</p>

The admin area includes dashboard stats, content management, media uploads, user roles, theme controls, security settings, and site configuration.

Recent UI update: the Admin Console dashboard typography was reduced by `3pt` for the dashboard topbar and dashboard content. The change is scoped with `admin-dashboard-page` and `admin-dashboard` classes in `views/admin/dashboard.ejs`, with the matching font-size rules in `public/css/admin.css`.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend | Node.js, Express.js |
| Database | MySQL |
| ORM | Sequelize |
| Views | EJS |
| UI | Bootstrap 5, custom CSS |
| Auth | Express Session, bcrypt |
| Uploads | Multer |
| Validation | Express Validator |
| Security | Helmet, CORS, CSRF, rate limiting |
| Editor | Self-hosted TinyMCE |

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-username/nodepress-cms.git
cd nodepress-cms
npm install
```

### 2. Configure environment

Create or update `.env`:

```env
NODE_ENV=development
APP_NAME="NodePress CMS"
APP_URL=http://localhost:3000
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nodepress_cms
DB_USER=root
DB_PASSWORD=

SESSION_SECRET=change-this-long-random-secret
SESSION_NAME=nodepress.sid
SESSION_MAX_AGE=86400000

UPLOAD_MAX_SIZE_MB=25
ADMIN_SESSION_TIMEOUT_MINUTES=60
```

### 3. Create database

```sql
CREATE DATABASE nodepress_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Sync and seed

```bash
npm run db:sync
npm run seed
```

### 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Default Admin

```text
Email:    admin@example.com
Password: Admin@12345
Role:     Super Admin
```

The seeded admin account requires a password change after first login.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the app with Node |
| `npm run dev` | Run the app with Nodemon |
| `npm run db:sync` | Sync Sequelize models to MySQL |
| `npm run seed` | Seed roles, permissions, settings, menus, themes, and default admin |

## Web Application Firewall

NodePress CMS includes an Express middleware WAF for public, admin, and API requests. Static assets are served before the WAF, while dynamic requests are inspected after body parsing, sessions, CSRF, and site context are available.

The WAF stores rules, logs, IP lists, settings, and dynamic rate-limit counters in MySQL through Sequelize: `waf_rules`, `waf_logs`, `waf_ip_lists`, `waf_settings`, and `waf_rate_limits`.

Admin users with `manage_waf` or `manage_security` can manage it from `/admin/waf`, `/admin/waf/settings`, `/admin/waf/rules`, `/admin/waf/logs`, and `/admin/waf/ip-lists`.

Default mode is `monitor`, so suspicious requests are logged before enforcement is enabled. Switch to `block` mode after reviewing logs and tuning false positives.

### WAF Database Setup

For a fresh Sequelize setup:

```bash
npm run db:sync
npm run seed
```

For SQL-managed installs:

```bash
mysql -u root -p nodepress_cms < database/migrations/006_waf_system.sql
mysql -u root -p nodepress_cms < database/seed_waf_rules.sql
```

### WAF Testing Checklist

1. Normal homepage loads.
2. Normal admin login works.
3. Normal post creation works.
4. Rich text post content does not get falsely blocked.
5. SQL injection-like query is blocked in block mode.
6. SQL injection-like query is logged in monitor mode.
7. XSS-like payload is blocked in block mode.
8. Bad bot user-agent is blocked.
9. Blacklisted IP is blocked.
10. Whitelisted IP bypasses block.
11. WAF logs are created.
12. WAF log detail page escapes malicious content.
13. Admin can enable/disable WAF.
14. Admin can switch monitor/block mode.
15. Admin can create custom rule.
16. Invalid custom regex does not crash the app.
17. Auto-block creates a temporary block after repeated high-risk events.
18. Static assets still load.
19. File uploads still work.
20. Dangerous upload names are blocked.

## Project Structure

```text
nodepress-cms/
├── config/              App and database config
├── controllers/         Admin and public controllers
├── database/            schema.sql, seed.sql, sync and seed scripts
├── middleware/          Auth, permissions, upload, security, errors
├── models/              Sequelize models and associations
├── public/              CSS, JS, uploads
├── routes/              Admin, public, and API routes
├── utils/               Slug, file, SEO, pagination helpers
├── views/               EJS admin/public/theme/error views
├── .env                 Environment variables
├── package.json
└── server.js
```

## Core Features

### Public Website

- Responsive space-agency inspired design
- Dynamic header and footer menus
- Homepage banner and slider
- Blog list and single post pages
- Category and tag archive pages
- Search page
- About, contact, privacy, terms, and custom pages
- Sidebar widgets for recent posts, popular posts, and categories
- SEO-friendly URLs, sitemap, robots.txt, canonical URLs, and schema output

### Admin Panel

- Dashboard cards and recent activity
- CRUD screens with search, filters, pagination, badges, and delete confirmations
- TinyMCE rich text editor
- Media upload library with URL copy
- Theme and layout customization
- Site settings for logo, favicon, social links, contact details, and maintenance mode
- Security plugin-style settings page

### Content Management

- Posts with title, slug, content, excerpt, status, category, tags, author, featured image, video URL, SEO title, SEO description, views, and publish date
- Pages with custom slug and SEO fields
- Nested categories and tags
- Comments with moderation
- Contact messages with read/unread status

### Users and Permissions

Default roles:

- Super Admin
- Admin
- Editor
- Author
- Subscriber

Example permissions:

- `manage_posts`
- `create_posts`
- `edit_posts`
- `delete_posts`
- `publish_posts`
- `manage_pages`
- `manage_media`
- `manage_users`
- `manage_roles`
- `manage_themes`
- `manage_settings`
- `manage_security`

## Main Routes

### Public

| Method | Route |
| --- | --- |
| `GET` | `/` |
| `GET` | `/blog` |
| `GET` | `/post/:slug` |
| `GET` | `/category/:slug` |
| `GET` | `/tag/:slug` |
| `GET` | `/page/:slug` |
| `GET` | `/search` |
| `GET` | `/contact` |
| `POST` | `/contact` |
| `POST` | `/post/:id/comment` |
| `GET` | `/sitemap.xml` |
| `GET` | `/robots.txt` |

### Admin

| Method | Route |
| --- | --- |
| `GET` | `/admin` |
| `GET/POST` | `/admin/login` |
| `POST` | `/admin/logout` |
| `GET/PUT` | `/admin/profile` |
| `GET/POST/PUT/DELETE` | `/admin/posts` |
| `GET/POST/PUT/DELETE` | `/admin/pages` |
| `GET/POST/PUT/DELETE` | `/admin/categories` |
| `GET/POST/PUT/DELETE` | `/admin/tags` |
| `GET/POST/DELETE` | `/admin/media` |
| `GET/POST/PUT/DELETE` | `/admin/users` |
| `GET/POST/PUT/DELETE` | `/admin/roles` |
| `GET/POST/PUT/DELETE` | `/admin/menus` |
| `GET/POST/PUT/DELETE` | `/admin/banners` |
| `GET/POST/PUT/DELETE` | `/admin/sliders` |
| `GET/PUT` | `/admin/settings` |
| `GET/POST/PUT` | `/admin/themes` |
| `GET/PUT/POST/DELETE` | `/admin/security` |

## Database

Schema and seed files are included:

```text
database/schema.sql
database/seed.sql
database/sync.js
database/seed.js
```

Manual import:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

Use `npm run seed` afterward to generate the bcrypt-hashed default admin account.

## Security

- Passwords are hashed with bcrypt.
- Admin routes are protected by session authentication.
- Sensitive admin pages use permission middleware.
- Helmet, CORS, rate limiting, CSRF, and secure cookie options are configured.
- File uploads validate type, size, and blocked executable extensions.
- Rich post/page HTML is sanitized before saving.
- Sequelize protects database queries from SQL injection.
- Login attempts, blocked IPs, and admin activity are logged.

Production recommendations:

- Set a strong `SESSION_SECRET`.
- Use HTTPS.
- Set `NODE_ENV=production`.
- Keep MySQL private.
- Put uploads behind safe server rules.
- Configure regular database backups.

## Deployment

### Ubuntu + Nginx + PM2

```bash
sudo apt update
sudo apt install -y nginx mysql-server
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Install and run:

```bash
cd /var/www/nodepress-cms
npm ci --omit=dev
npm run db:sync
npm run seed
pm2 start server.js --name nodepress-cms
pm2 save
pm2 startup
```

Nginx config:

```nginx
server {
  listen 80;
  server_name example.com www.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/nodepress-cms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

## Troubleshooting

### TinyMCE says editors are read-only

This project uses self-hosted TinyMCE from `node_modules/tinymce`. Restart the server after installing dependencies:

```bash
npm install
npm run dev
```

### Database connection fails

Check `.env`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=nodepress_cms
DB_USER=root
DB_PASSWORD=
```

Then verify MySQL is running and the database exists.

### Uploaded files do not appear

Check that `public/uploads` exists and the server process can write to it.

## Customization

- Public theme styles: `public/css/site.css`
- Admin theme styles: `public/css/admin.css`
- Public EJS templates: `views/public`
- Admin EJS templates: `views/admin`
- CRUD resources: `controllers/admin/crudController.js`
- Models and relations: `models/`
- Default seed data: `database/seed.js`

## License

MIT License. Use, modify, and deploy freely.
#   n o d e _ c m s 
 
 