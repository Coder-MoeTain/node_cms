# Admin Guide

For site administrators and editors using the NodePress admin panel.

## Logging in

1. Open `/admin/login`
2. Enter email and password
3. If 2FA is enabled, enter authenticator code **or** a one-time recovery code
4. Change default password on first login when prompted

## Dashboard

- Quick stats: posts, pages, comments, media
- Quick draft — create a post from the dashboard
- Plugin dashboard widgets (if plugins register them)

## Content

| Section | Purpose |
|---------|---------|
| Posts | Blog articles with categories, tags, SEO |
| Pages | Static pages (About, Contact, etc.) |
| Custom Post Types | Admin-defined content types (news, events, …) |
| Media | Upload images and files; copy URL for embedding |

### Editor

- **Classic** — TinyMCE rich text
- **Blocks** — JSON block editor for structured layouts
- **Autosave** — drafts saved automatically while editing
- **Revisions** — view and restore previous versions

## Appearance

- **Themes** — activate, preview, upload ZIP, customize colors/logo
- **Templates** — site-wide block templates (header, footer, homepage)
- **Menus / Banners / Sliders** — navigation and homepage sections

## Users & security

- **Users** — create accounts, assign roles
- **Roles** — permission sets (Super Admin, Admin, Editor, Author, Subscriber)
- **Security** — login lockout settings, blocked IPs
- **WAF** — Web Application Firewall rules and logs
- **Profile** — update name, email, password, enable 2FA

## Tools

- **Import / Export** — JSON site backup and migration
- **Site Health** — database, disk, PHP-style checks for Node stack
- **Database** — backup and restore (super-admin)

## Tips

- Use **draft** until content is ready, then **publish**
- Set **featured image** and **SEO title** on every public post
- Test theme changes with **Preview** before activating
- Export site JSON before major imports

See [USER_GUIDE.md](USER_GUIDE.md) for public-site visitors and [SECURITY.md](SECURITY.md) for hardening.
