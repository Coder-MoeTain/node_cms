const request = require('supertest');
const themeLoader = require('../utils/themeLoader');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('discoverThemeAssets reports template chain', () => {
  const assets = themeLoader.discoverThemeAssets('minimal-personal');
  expect(assets.chain).toEqual(expect.arrayContaining(['minimal-personal', 'classic-blog']));
});

test('resolveThemeChain walks multiple parent levels', () => {
  const chain = themeLoader.resolveThemeChain('minimal-personal').map((t) => t.manifest.slug);
  expect(chain[0]).toBe('minimal-personal');
  expect(chain).toContain('classic-blog');
});

test('admin can view themes page with template metadata', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/themes');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Install Theme/i);
  expect(page.text).toMatch(/templates/i);
});

test('admin can activate a theme', async () => {
  const theme = await models.Theme.findOne({ where: { slug: 'classic-blog' } });
  expect(theme).toBeTruthy();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrfPage = await agent.get('/admin/themes');
  const csrf = csrfPage.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent.post('/admin/themes/activate').type('form').send({
    theme_id: theme.id,
    _csrf: csrf
  });
  expect(response.status).toBe(302);
  await theme.reload();
  expect(theme.active).toBe(true);
});

test('active theme cannot be uninstalled', async () => {
  const active = await models.Theme.findOne({ where: { active: true } });
  expect(active).toBeTruthy();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes');
  const response = await agent.post(`/admin/themes/${active.slug}/uninstall`).type('form').send({ _csrf: csrf });
  expect(response.status).toBe(302);
  const stillThere = await models.Theme.findOne({ where: { slug: active.slug } });
  expect(stillThere).toBeTruthy();
});
