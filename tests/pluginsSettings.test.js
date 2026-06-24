const request = require('supertest');
const { app } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  const { models } = require('../server');
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
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
  const page = await agent.get('/admin/plugins/cookie-notice/settings');
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent
    .put('/admin/plugins/cookie-notice/settings')
    .type('form')
    .send({
      enabled: 'on',
      message: 'We use cookies in tests.',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
});
