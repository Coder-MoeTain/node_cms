const request = require('supertest');
const { app } = require('../server');
const pluginLoader = require('../utils/pluginLoader');
const { login, putForm } = require('./helpers');

beforeAll(async () => {
  const { models } = require('../server');
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  await pluginLoader.syncInstalledPlugins();
});

test('admin can open plugin settings page', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/plugins/cookie-notice/settings');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Settings|cookie/i);
});

test('admin can update plugin settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await putForm(
    agent,
    '/admin/plugins/cookie-notice/settings',
    {
      enabled: 'on',
      message: 'We use cookies in tests.'
    },
    '/admin/plugins/cookie-notice/settings'
  );
  expect(response.status).toBe(302);
});
