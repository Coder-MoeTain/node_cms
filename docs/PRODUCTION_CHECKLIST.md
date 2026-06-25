# Production Checklist

Use this before go-live and after each major upgrade.

## Environment

- [ ] `NODE_ENV=production`
- [ ] `SESSION_SECRET` — long random value (app refuses default in production)
- [ ] `APP_URL` — public HTTPS URL
- [ ] `DB_*` — production MySQL credentials
- [ ] `TRUST_PROXY=true` behind Nginx/load balancer
- [ ] `CORS_ORIGIN` — production origin only
- [ ] `API_KEY` set if exposing `/api` publicly

## Database

- [ ] `npm run migrate` applied (0 pending: `npm run migrate:status`)
- [ ] Backup taken before migration (`npm run backup` or mysqldump)
- [ ] Restore procedure documented and tested ([BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md))

## Application

- [ ] `npm ci --omit=dev`
- [ ] PM2 cluster: `npm run pm2:start:prod`
- [ ] `npm run health` returns 200 for `/health` and `/ready`
- [ ] Uploads directory writable (`public/uploads/`)
- [ ] Logs directory writable (`logs/` when `LOG_TO_FILE=true`)

## Security

- [ ] WAF enabled in **monitor** mode first; review logs; then **block** ([SECURITY.md](./SECURITY.md))
- [ ] Default admin password changed; `force_password_change` cleared
- [ ] 2FA enabled for super-admin accounts (recommended)
- [ ] `npm audit --audit-level=high` clean
- [ ] Firewall: only 80/443 public; MySQL not exposed

## Docker (if used)

- [ ] `docker compose up -d --build`
- [ ] Volumes for `uploads` and MySQL data
- [ ] Healthcheck passing in compose

## CI / release

- [ ] GitHub Actions CI green on release commit
- [ ] Tag release `v*` triggers deploy workflow (optional SSH secrets configured)
- [ ] Post-deploy: `npm run migrate` + `npm run pm2:reload`

## Monitoring

- [ ] Uptime check on `/health` (liveness)
- [ ] Readiness check on `/ready` (DB connectivity)
- [ ] Disk space for uploads and backups
- [ ] Review WAF logs and activity logs weekly

## Documentation

- [ ] [DEPLOYMENT.md](./DEPLOYMENT.md) — Nginx/SSL steps completed
- [ ] On-call knows [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
