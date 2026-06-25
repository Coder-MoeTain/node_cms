const request = require('supertest');
const { app } = require('../server');
const pkg = require('../package.json');

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('GET /ready checks database', async () => {
  const res = await request(app).get('/ready');
  expect([200, 503]).toContain(res.status);
  expect(res.body).toHaveProperty('database');
});

test('GET /version returns package metadata', async () => {
  const res = await request(app).get('/version');
  expect(res.status).toBe(200);
  expect(res.body.version).toBe(pkg.version);
  expect(res.body.name).toBe(pkg.name);
});
