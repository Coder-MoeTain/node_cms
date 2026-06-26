const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin dashboard loads with stats', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Dashboard|Posts|Pages/i);
});

test('admin can view site settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/settings');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Settings|Site title|timezone/i);
});

test('admin can update site settings with placeholder social links', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/settings');
  const response = await agent
    .put('/admin/settings')
    .type('form')
    .send({
      site_title: 'NodePress Test Site',
      facebook_link: '#',
      app_store_link: '/contact',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const facebook = await models.SiteSetting.findOne({ where: { key: 'facebook_link' } });
  expect(facebook?.value).toBe('#');
});

test('admin can upload site logo without site_logo in form body', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/settings');
  const response = await agent
    .post(`/admin/settings?_method=PUT&_csrf=${encodeURIComponent(csrf)}`)
    .set('x-csrf-token', csrf)
    .attach('site_logo_file', PNG, { filename: 'settings-logo.png', contentType: 'image/png' });
  expect(response.status).toBe(302);
  const logo = await models.SiteSetting.findOne({ where: { key: 'site_logo' } });
  expect(logo?.value).toMatch(/^\/uploads\//);
});

test('admin can update site timezone', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/settings');
  const response = await agent
    .put('/admin/settings')
    .type('form')
    .send({
      site_timezone: 'Asia/Tokyo',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const tz = await models.SiteSetting.findOne({ where: { key: 'site_timezone' } });
  expect(tz?.value).toBe('Asia/Tokyo');
});

test('author cannot access site settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const response = await agent.get('/admin/settings');
  expect([302, 403]).toContain(response.status);
});
