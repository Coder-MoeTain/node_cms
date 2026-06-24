#!/usr/bin/env node
require('dotenv').config();
const http = require('http');

const port = Number(process.env.PORT || 3000);
const base = process.env.APP_URL || `http://127.0.0.1:${port}`;

function check(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  const health = await check('/health');
  const ready = await check('/ready');
  const ok = health.status === 200 && ready.status === 200;
  console.log(`health: ${health.status} ${health.body}`);
  console.log(`ready: ${ready.status} ${ready.body}`);
  process.exit(ok ? 0 : 1);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
