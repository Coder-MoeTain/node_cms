# NodePress CMS Security

## Current Security Status

NodePress CMS uses layered Express protections:

- Helmet with a restrictive content security policy and CORS configuration.
- `express-rate-limit` for global API traffic, admin login attempts, and public mutation routes.
- `express-session` with a Sequelize-backed store, `httpOnly` cookies, `sameSite: lax`, production-only secure cookies, and an admin inactivity timeout.
- Custom session-based CSRF protection in `middleware/csrf.js`.
- Upload validation through `multer` file filters, extension checks, MIME checks, and upload size limits.
- Input validation through `express-validator` and HTML sanitization for CMS content.
- Login attempt persistence through `LoginAttempt`.
- Legacy `blocked_ips` table checked globally in `middleware/security.js`.
- Admin authentication, RBAC permission checks, resource permission checks, and activity logging.
- **Web Application Firewall (WAF)** with rules, logs, IP lists, rate limits, and admin dashboard.

## Middleware Flow

1. Trust proxy from `config/app.js`.
2. Compression and request logging.
3. Helmet, CORS, global rate limit, and legacy blocked IP check.
4. Static assets (bypass WAF).
5. URL-encoded and JSON body parsing.
6. Cookies, method override, session, flash, CSRF, admin locals, and site context.
7. **WAF middleware** — inspects dynamic requests after body parsing.
8. Maintenance mode.
9. Admin routes, API routes, and public routes.
10. 404 and error handlers.

Static assets are served before body parsing and WAF inspection to avoid unnecessary database and regex work.

## WAF Overview

The WAF is defensive only. It detects suspicious requests, logs them, scores risk, and optionally blocks traffic. It does not replace existing security features:

| Feature | Location | Purpose |
|---------|----------|---------|
| Legacy blocked IPs | `middleware/security.js` + `BlockedIp` | Early global block list |
| Login attempts | `LoginAttempt` + `loginLimiter` + `loginBruteForce` | Per-IP throttling, account lockout, auto IP block |

### Login brute-force protection

Admin login uses layered defenses:

| Layer | Default | Purpose |
|-------|---------|---------|
| Rate limit | 10 POSTs / 15 min per IP | Fast in-memory cap (`loginLimiter`) |
| IP failure window | 10 failures / 15 min | Blocks further logins from abusive IPs |
| Account lockout | 5 failures / 15 min lock | Locks the targeted user account |
| Auto IP block | 25 failures | Adds IP to `blocked_ips` |

Configure under **Admin → Security → Login Brute-Force Protection**, or via `.env`:

```env
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_MINUTES=15
LOGIN_MAX_IP_ATTEMPTS=10
LOGIN_IP_WINDOW_MINUTES=15
LOGIN_AUTO_BLOCK_IP_ATTEMPTS=25
```

Toggle the whole feature with **Login Attempt Limiter** on the security settings page.
| Activity logs | `activityLog.js` | Admin mutation audit trail |
| WAF IP lists | `WafIpList` | Whitelist, blacklist, temporary blocks |
| WAF logs | `WafLog` | Request inspection events |

## WAF Modes

| Mode | Behavior |
|------|----------|
| `disabled` | WAF does nothing |
| `monitor` | Logs suspicious requests, does not block |
| `block` | Logs and blocks based on rules and risk score |

**Recommended production rollout:**

1. `waf_enabled: true`
2. `waf_mode: monitor` for 24–48 hours
3. Review `/admin/waf/logs` for false positives
4. Tune rules or thresholds
5. Switch to `block` mode

## WAF Architecture Layers

1. Request identification (`createRequestId`)
2. Client IP detection (`getClientIp`, respects `trusted_proxy_enabled`)
3. Whitelist check (`waf_ip_lists`)
4. Blacklist / temporary block check
5. Static asset bypass
6. Admin route detection (stricter scoring)
7. Request normalization
8. Rule matching (`regex`, `contains`, `equals`)
9. Risk score calculation
10. Action decision (`log`, `block`, `rate_limit`, `temporary_block`)
11. Log creation with masked sensitive fields
12. Auto-block decision
13. Safe 403 response (HTML page or JSON)

## How to Enable WAF

```bash
npm run migrate
npm run seed
npm run dev
```

Then open **Admin → Security → WAF Settings** (`/admin/waf/settings`) and enable the WAF.

Or set in database:

```sql
UPDATE waf_settings SET setting_value = 'true' WHERE setting_key = 'waf_enabled';
UPDATE waf_settings SET setting_value = 'monitor' WHERE setting_key = 'waf_mode';
```

## Custom WAF Rule

1. Go to `/admin/waf/rules/create`
2. Choose category, target, pattern type, action, severity, and score
3. Save the rule
4. Test in monitor mode first

Pattern types:

- `regex` — regular expression (invalid patterns are rejected)
- `contains` — case-insensitive substring
- `equals` — exact match after normalization

## IP Whitelist / Blacklist

1. Go to `/admin/waf/ip-lists`
2. Add IP with list type `whitelist`, `blacklist`, or `temporary_block`
3. Or block/whitelist directly from a log detail page

Whitelisted IPs bypass WAF blocks. Blacklisted and temporary blocks are enforced in block mode.

## Auto-Block

When `auto_block_enabled` is true:

- Counts critical/high severity WAF events per IP inside `auto_block_window_minutes`
- Creates a `temporary_block` entry in `waf_ip_lists` when threshold is reached
- Respects whitelist entries
- Expires after `auto_block_duration_minutes`

## False Positive Tuning

1. Start in monitor mode
2. Filter logs by category and matched rule
3. Disable noisy system rules or lower their score
4. Raise `max_risk_score_public` / `max_risk_score_admin` slightly
5. Whitelist trusted office IPs if needed
6. Authenticated admin rich-text fields (`content`, `excerpt`, `description`) are skipped during inspection

## Recommended Production Settings

```text
waf_enabled: true
waf_mode: monitor (first), then block
admin_protection_enabled: true
public_protection_enabled: true
auto_block_enabled: true
log_all_suspicious: true
max_risk_score_public: 50
max_risk_score_admin: 40
```

## Database Objects

- `waf_rules`, `waf_logs`, `waf_ip_lists`, `waf_settings`, `waf_rate_limits`
- Migrations: `006_waf_system.sql`, `007_waf_enhancements.sql`
- Seed: `database/seed_waf_rules.sql`

## Permissions

WAF admin requires `manage_waf` or `manage_security` (assigned to Super Admin and Admin roles).

## Testing Checklist

See `tests/waf.test.js` for automated coverage. Manual checks:

1. Homepage loads normally
2. Admin login loads and works
3. Post creation with rich text works
4. SQLi query logged in monitor mode
5. SQLi query blocked in block mode
6. XSS payload logged/blocked appropriately
7. Scanner user-agent blocked in block mode
8. `/.env` probe blocked
9. Blacklisted IP blocked; whitelisted IP bypasses
10. Temporary block expires
11. Invalid custom regex does not crash app
12. WAF log detail escapes payload
13. Settings update and cache refresh
14. Custom rule create/toggle
15. Static assets load
16. Allowed uploads work; dangerous filenames blocked/logged
17. JSON requests get JSON 403; HTML requests get clean 403 page
18. Logs do not store passwords or tokens

## Deployment Notes

1. Back up the database.
2. Deploy the code.
3. Run `npm run migrate && npm run seed`.
4. Visit `/admin/waf/settings`.
5. Monitor logs before enabling block mode.
6. Set `TRUST_PROXY=true` in `.env` when behind Nginx/Cloudflare and enable `trusted_proxy_enabled` in WAF settings.
