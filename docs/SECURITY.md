# NodePress CMS Security

## Current Security Status

NodePress CMS already uses layered Express protections:

- Helmet with a restrictive content security policy and CORS configuration.
- `express-rate-limit` for global API traffic, admin login attempts, and public mutation routes.
- `express-session` with a Sequelize-backed store, `httpOnly` cookies, `sameSite: lax`, production-only secure cookies, and an admin inactivity timeout.
- CSRF protection through `csurf`.
- Upload validation through `multer` file filters, extension checks, MIME checks, and upload size limits.
- Input validation through `express-validator` and HTML sanitization for CMS content.
- Login attempt persistence through `LoginAttempt`.
- A legacy `blocked_ips` table checked globally in `middleware/security.js`.
- Admin authentication, role permission checks, resource permission checks, and activity logging.

## Middleware Flow

The runtime flow is:

1. Trust proxy from `config/app.js`.
2. Compression and request logging.
3. Helmet, CORS, global rate limit, and legacy blocked IP check.
4. Static assets.
5. URL-encoded and JSON body parsing.
6. Cookies, method override, session, flash, CSRF, admin locals, and site context.
7. WAF middleware.
8. Maintenance mode.
9. Admin routes, API routes, and public routes.
10. 404 and error handlers.

Static assets are intentionally served before body parsing and WAF inspection to avoid unnecessary database and regex work on CSS, JS, media, theme, upload, and vendor assets.

## Admin Route Protection

Admin routes are protected by `requireAuth` after login/reset/profile routes. Route-level permission checks use `can`, `canAny`, and resource-level policy checks. The WAF admin routes require either `manage_waf` or `manage_security`.

## Public Route Protection

Public routes use validation and mutation rate limits for contact/comment forms. The WAF now adds request inspection for public routes, query strings, headers, user agents, and non-rich body fields.

## Blocked IP and Activity Logs

The existing `blocked_ips` system remains active for simple global blocks. The WAF adds richer `waf_ip_lists` support with whitelist, blacklist, and temporary block entries. Existing admin mutations continue to be written to `activity_logs`; WAF events are written to `waf_logs`.

## WAF Architecture

The WAF is implemented as `middleware/waf.js` with helper functions in `utils/wafHelper.js`. It loads active settings and rules from MySQL/Sequelize, caches them briefly, and safely evaluates regex rules against:

- URL
- Query values
- Body values, excluding authenticated admin rich-text fields to reduce CMS authoring false positives
- Headers
- User agent
- IP address

Sensitive values such as passwords, CSRF tokens, cookies, authorization headers, sessions, and secrets are masked before being stored in WAF logs.

## Database Objects

The WAF uses:

- `models/WafRule.js`
- `models/WafLog.js`
- `models/WafIpList.js`
- `models/WafSetting.js`
- `models/WafRateLimit.js`
- `database/migrations/006_waf_system.sql`
- `database/seed_waf_rules.sql`

Default rules cover SQL injection indicators, XSS indicators, path traversal, command injection, scanner user agents, and sensitive file probes. Rules are defensive detection patterns only.

## Deployment Notes

1. Back up the database.
2. Deploy the code.
3. Run `npm run db:sync && npm run seed`, or apply `database/migrations/006_waf_system.sql` and `database/seed_waf_rules.sql`.
4. Visit `/admin/waf/settings`.
5. Keep `waf_mode=monitor` at first.
6. Review `/admin/waf/logs` for false positives.
7. Tune or disable noisy rules.
8. Switch to `block` mode when the log stream is clean.
9. Set `TRUST_PROXY=true` only when Express is behind a trusted reverse proxy.
10. Schedule WAF log cleanup according to retention requirements.

## Manual Testing Checklist

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
17. Auto-block works.
18. Static assets still load.
19. File uploads still work.
20. Dangerous upload names are blocked.
