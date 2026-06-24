# NodePress CMS Deployment

## Docker

```bash
cp .env.example .env   # set SESSION_SECRET and DB_PASSWORD
docker compose up -d --build
docker compose exec app npm run migrate
docker compose exec app npm run seed
```

The app listens on port 3000. MySQL data and uploads are stored in Docker volumes.

## Production Commands

```bash
npm ci --omit=dev
npm run migrate
npm run pm2:start:prod
npm run health
```

For zero-downtime reload after deploy:

```bash
npm run migrate
npm run pm2:reload
npm run health
```

## PM2

The `ecosystem.config.js` file configures cluster mode, log rotation, memory limits, and graceful shutdown.

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEB_CONCURRENCY` | `1` | PM2 cluster instances (use sticky sessions or shared session store when > 1) |
| `LOG_TO_FILE` | `true` in production | Write PM2 logs to `./logs/` |
| `LOG_LEVEL` | `info` | Winston log level |

Always start production with the production env profile:

```bash
pm2 start ecosystem.config.js --env production
```

The app sends `process.send('ready')` when listening so PM2 `wait_ready` works correctly.

## Required Environment

- `NODE_ENV=production`
- `APP_URL=https://your-domain.example`
- `SESSION_SECRET` set to a long random value
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `TRUST_PROXY=true` behind Nginx or a load balancer
- `CORS_ORIGIN=https://your-domain.example`

## Health Checks

- `GET /health` — process liveness (always 200 when running).
- `GET /ready` — database connectivity (503 when DB is unavailable).
- `npm run health` — CLI probe for both endpoints (used by Docker HEALTHCHECK).

Use `/ready` for load balancer and orchestrator readiness probes.

## Nginx Example

```nginx
server {
  listen 80;
  server_name your-domain.example;
  client_max_body_size 25m;

  location /uploads/ {
    proxy_pass http://127.0.0.1:3000/uploads/;
    add_header X-Content-Type-Options nosniff;
    expires 30d;
  }

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3000;
  }
}
```

## Rollback

1. Stop PM2: `pm2 stop nodepress-cms`.
2. Restore the previous release directory.
3. Restore database backup if a migration changed schema.
4. Start PM2: `npm run pm2:start:prod`.
