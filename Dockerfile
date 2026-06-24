FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache vips-dev build-base python3 \
  && apk add --no-cache vips \
  && rm -rf /var/cache/apk/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p public/uploads && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node scripts/health-check.js

RUN chmod +x scripts/docker-entrypoint.sh
ENTRYPOINT ["scripts/docker-entrypoint.sh"]
