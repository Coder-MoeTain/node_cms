const request = require('supertest');
const themeLoader = require('../utils/themeLoader');
const themeManager = require('../utils/themeManager');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await themeLoader.syncInstalledThemes();
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

test('admin can view theme detail page', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/themes/classic-blog');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Templates/i);
});

test('admin can view themes page with template metadata', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const page = await agent.get('/admin/themes');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/Install Theme/i);
  expect(page.text).toMatch(/templates/i);
});

async function pickActivatableTheme() {
  await themeLoader.syncInstalledThemes();
  const themes = await models.Theme.findAll({ order: [['slug', 'ASC']] });
  for (const theme of themes) {
    try {
      themeManager.validateThemeForActivation(theme.slug);
      return theme;
    } catch {
      // try next bundled theme
    }
  }
  throw new Error('No activatable theme found for tests.');
}

test('admin can activate a theme via HTTP', async () => {
  await themeLoader.syncInstalledThemes();
  const theme = await pickActivatableTheme();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrfPage = await agent.get('/admin/themes');
  const csrf = csrfPage.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent.post('/admin/themes/activate').type('form').send({
    theme_id: String(theme.id),
    _csrf: csrf
  });
  expect(response.status).toBe(302);
});

test('active theme cannot be uninstalled', async () => {
  await themeLoader.syncInstalledThemes();
  let active = await models.Theme.findOne({ where: { active: true } });
  if (!active) {
    const theme = await pickActivatableTheme();
    try {
      await themeManager.activateTheme(theme.id);
    } catch {
      await models.Theme.update({ active: false }, { where: {} });
      await models.Theme.update({ active: true }, { where: { id: theme.id } });
    }
    active = await models.Theme.findOne({ where: { active: true } });
  }
  expect(active).toBeTruthy();
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/themes');
  const response = await agent.post(`/admin/themes/${active.slug}/uninstall`).type('form').send({ _csrf: csrf });
  expect(response.status).toBe(302);
  const stillThere = await models.Theme.findOne({ where: { slug: active.slug } });
  expect(stillThere).toBeTruthy();
});
