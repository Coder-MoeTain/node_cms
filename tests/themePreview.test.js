const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('theme customize preview redirects to public site with flag', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/themes/customize/preview');
  expect(response.status).toBe(302);
  expect(response.headers.location).toMatch(/customizer_preview=1/);
});

test('theme preview draft stores customizer draft in session', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes/customize');
  const response = await agent
    .post('/admin/theme-settings/preview')
    .set('x-csrf-token', csrf)
    .send({ primary_color: '#112233', secondary_color: '#445566' });
  expect(response.status).toBe(200);
  expect(response.body.ok).toBe(true);
  const home = await agent.get('/?customizer_preview=1');
  expect(home.status).toBe(200);
});

test('admin can open theme customizer', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/themes/customize');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Customize|Theme/i);
});
