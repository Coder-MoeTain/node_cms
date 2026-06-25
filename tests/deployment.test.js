const fs = require('fs');
const path = require('path');

test('docker compose defines app, db, and health dependencies', () => {
  const compose = fs.readFileSync(path.join(process.cwd(), 'docker-compose.yml'), 'utf8');
  expect(compose).toMatch(/services:/);
  expect(compose).toMatch(/^\s+app:/m);
  expect(compose).toMatch(/^\s+db:/m);
  expect(compose).toMatch(/condition:\s*service_healthy/);
  expect(compose).toMatch(/\$\{PORT:-3000\}:3000|"3000:3000"/);
});

test('Dockerfile builds production image with healthcheck', () => {
  const dockerfile = fs.readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
  expect(dockerfile).toMatch(/FROM node:/);
  expect(dockerfile).toMatch(/EXPOSE 3000/);
  expect(dockerfile).toMatch(/HEALTHCHECK/);
  expect(dockerfile).toMatch(/docker-entrypoint\.sh/);
});

test('docker entrypoint runs migrations before server start', () => {
  const entrypoint = fs.readFileSync(path.join(process.cwd(), 'scripts', 'docker-entrypoint.sh'), 'utf8');
  expect(entrypoint).toMatch(/database\/migrate\.js/);
  expect(entrypoint).toMatch(/server\.js/);
});

test('PM2 ecosystem config defines production cluster app', () => {
  const config = require('../ecosystem.config.js');
  const app = config.apps[0];
  expect(app.name).toBe('nodepress-cms');
  expect(app.script).toBe('server.js');
  expect(app.exec_mode).toBe('cluster');
  expect(app.env_production.NODE_ENV).toBe('production');
  expect(config.deploy.production['post-deploy']).toMatch(/migrate/);
});

test('bootstrap test database script resets schema for CI', () => {
  const script = path.join(process.cwd(), 'database', 'bootstrapTestDatabase.js');
  expect(fs.existsSync(script)).toBe(true);
  const source = fs.readFileSync(script, 'utf8');
  expect(source).toMatch(/DROP DATABASE IF EXISTS/);
  expect(source).toMatch(/sequelize\.sync/);
});

test('remote deploy script runs migrations and PM2 reload', () => {
  const script = path.join(process.cwd(), 'scripts', 'remote-deploy.sh');
  expect(fs.existsSync(script)).toBe(true);
  const source = fs.readFileSync(script, 'utf8');
  expect(source).toMatch(/npm run migrate/);
  expect(source).toMatch(/pm2:reload/);
});

test('health check script validates local endpoints', async () => {
  const healthScript = path.join(process.cwd(), 'scripts', 'health-check.js');
  expect(fs.existsSync(healthScript)).toBe(true);
  const source = fs.readFileSync(healthScript, 'utf8');
  expect(source).toMatch(/health/);
});

test('package scripts expose deploy and validation commands', () => {
  const pkg = require('../package.json');
  expect(pkg.scripts['pm2:start:prod']).toBeTruthy();
  expect(pkg.scripts.predeploy).toMatch(/test:ci/);
  expect(pkg.scripts.validate).toMatch(/test/);
  expect(pkg.scripts['test:ci']).toMatch(/coverage/);
});
