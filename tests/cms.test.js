const request = require('supertest');
const { app, models } = require('../server');

test('public home page responds with security headers', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBeLessThan(500);
  expect(response.headers['x-content-type-options']).toBe('nosniff');
});

test('CSRF rejects mutation without token', async () => {
  const response = await request(app).post('/contact').send({
    name: 'Tester',
    email: 'tester@example.com',
    subject: 'Hello',
    message: 'Testing CSRF rejection'
  });
  expect(response.status).toBe(403);
});

test('plugin manifests can sync to database', async () => {
  const pluginLoader = require('../utils/pluginLoader');
  await pluginLoader.syncInstalledPlugins();
  const count = await models.Plugin.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('theme manifests can sync to database', async () => {
  const themeLoader = require('../utils/themeLoader');
  await themeLoader.syncInstalledThemes();
  const count = await models.Theme.count();
  expect(count).toBeGreaterThanOrEqual(3);
});
