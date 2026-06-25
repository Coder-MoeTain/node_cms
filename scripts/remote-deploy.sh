#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/var/www/nodepress-cms}"
DEPLOY_REF="${DEPLOY_REF:-main}"
NODE_ENV="${NODE_ENV:-production}"

cd "$DEPLOY_PATH"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git fetch origin "$DEPLOY_REF"
  git checkout "$DEPLOY_REF"
  git pull --ff-only origin "$DEPLOY_REF"
else
  echo "DEPLOY_PATH is not a git repository: $DEPLOY_PATH" >&2
  exit 1
fi

export NODE_ENV
npm ci --omit=dev
npm run migrate

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe nodepress-cms >/dev/null 2>&1; then
    npm run pm2:reload
  else
    npm run pm2:start:prod
  fi
else
  echo "pm2 not found; start the app manually with: npm start" >&2
fi

if command -v node >/dev/null 2>&1 && [ -f scripts/health-check.js ]; then
  node scripts/health-check.js || true
fi

echo "Deploy complete at $(date -Is)"
