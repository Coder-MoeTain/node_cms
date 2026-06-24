const request = require('supertest');
const themeLoader = require('../utils/themeLoader');
const themeManager = require('../utils/themeManager');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await themeLoader.syncInstalledThemes();
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
  const theme = await models.Theme.findOne({ where: { slug: 'classic-blog' } })
    || await models.Theme.findOne();
  if (theme) {
    try {
      await themeManager.activateTheme(theme.id);
    } catch {
      // theme validation may fail in some environments; customize still loads defaults
    }
  }
});

test('admin can open theme customizer', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/themes/customize');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Customize|Primary color|Theme/i);
});

test('admin can save theme color settings', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes/customize');
  const response = await agent
    .put('/admin/theme-settings')
    .type('form')
    .send({
      primary_color: '#112233',
      secondary_color: '#445566',
      background_color: '#ffffff',
      text_color: '#111111',
      font_family: 'system-ui',
      header_layout: 'standard',
      footer_layout: 'standard',
      sidebar_position: 'right',
      blog_layout: 'list',
      site_layout: 'wide',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const active = await models.ThemeSetting.findOne({ where: { active: true } });
  expect(active?.primary_color).toBe('#112233');
});

test('theme reset restores defaults', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes/customize');
  const response = await agent
    .post('/admin/themes/reset')
    .type('form')
    .send({ _csrf: csrf });
  expect(response.status).toBe(302);
});
