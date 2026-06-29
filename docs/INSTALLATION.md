# Installation Guide

## Requirements

| Component | Minimum |
|-----------|---------|
| Node.js | 20+ (22 recommended) |
| MySQL | 8.0+ |
| RAM | 1 GB (2 GB+ recommended) |
| Disk | 2 GB+ (uploads grow over time) |

Optional: Docker 24+, PM2, Nginx, SSL certificate.

## Quick install (development)

```bash
# Clone or copy the project into nodepress_cms, then:
cd nodepress_cms
cp .env.example .env
# Edit .env — set DB_*, SESSION_SECRET, APP_URL
npm install
npm run migrate
npm run seed
npm run dev
```

- Public site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin/login`
- Default seed login: `admin@example.com` / `Admin@12345` (change immediately)

## Production install

```bash
npm ci --omit=dev
npm run migrate
NODE_ENV=production npm start
# or: pm2 start ecosystem.config.js --env production
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/version
```

## Post-install checklist

1. Change admin password and clear `force_password_change`
2. Set a strong `SESSION_SECRET` (32+ random bytes)
3. Set `API_KEY` if exposing `/api` publicly
4. Run `npm run health`
5. Configure backups — see [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md)
6. Review [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md)

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
