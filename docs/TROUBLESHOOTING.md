# Troubleshooting

## Application won't start

| Symptom | Cause | Fix |
|---------|--------|-----|
| `SESSION_SECRET must be set` | Default secret in production | Set `SESSION_SECRET` in `.env` |
| `ECONNREFUSED` to MySQL | DB down or wrong `DB_HOST` | Start MySQL; verify `.env` |
| Port in use | Another process on 3000 | Change `PORT` or stop conflicting app |

## Database

| Symptom | Fix |
|---------|-----|
| `ER_TOO_MANY_KEYS` during sync | Do not use `sync({ alter: true })` on long-lived DBs; use `npm run migrate` |
| Migration pending | `npm run migrate` |
| Test failures locally | Ensure `TEST_DB_NAME=nodepress_cms_test`; run `npm run test:ci` (auto-bootstrap) |

## Admin login

| Symptom | Fix |
|---------|-----|
| Invalid credentials | Reset: `npm run reset-admin` |
| Account locked | Wait 15 minutes or clear `locked_until` on user row |
| 2FA required | Enter TOTP from authenticator app |
| Force password change | Complete profile password update |

## Uploads

| Symptom | Fix |
|---------|-----|
| Upload fails | Check `public/uploads/` permissions; max size 25 MB |
| ZIP theme/plugin rejected | Only `.zip`; check manifest inside archive |
| Dangerous file blocked | Expected — WAF/upload filters block executables |

## WAF

| Symptom | Fix |
|---------|-----|
| Legitimate requests blocked | Switch `waf_mode` to `monitor`; whitelist IP in WAF IP lists |
| No WAF logs | Enable `waf_enabled`; check `waf_mode` not `disabled` |
| Admin blocked | Lower `max_risk_score_admin` or whitelist admin IP |

## Docker

```bash
docker compose logs app
docker compose logs db
docker compose exec app npm run migrate
docker compose exec app node scripts/health-check.js
```

## CI failures

1. Run locally: `npm run lint && npm run test:ci`
2. Check GitHub Actions log for failing test name
3. Verify `adm-zip` installed (`npm ci`)
4. MySQL service must be healthy before tests on Ubuntu runners

## Performance

- Enable `super-cache` plugin for cache headers
- PM2 cluster: set `WEB_CONCURRENCY` (use shared session store — already MySQL)
- Sharp/image plugins: ensure sufficient memory for image processing

## Getting help

1. Check [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) and [UPGRADE_ANALYSIS.md](./UPGRADE_ANALYSIS.md)
2. Review activity logs and WAF logs in admin
3. Open an issue with CI log, `npm run migrate:status`, and steps to reproduce
