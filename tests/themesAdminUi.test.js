const request = require('supertest');
const { buildThemeScreenshotSvg } = require('../utils/themeScreenshotArt');
const { enrichTheme, getThemeManagerStats } = require('../utils/themeAdmin');
const themeLoader = require('../utils/themeLoader');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

describe('themeAdmin utils', () => {
  test('buildThemeScreenshotSvg uses manifest colors', () => {
    const svg = buildThemeScreenshotSvg({
      slug: 'dark-elegant',
      name: 'Dark Elegant',
      defaults: {
        primary_color: '#38bdf8',
        background_color: '#0f172a',
        text_color: '#f8fafc',
        dark_mode: true
      }
    });
    expect(svg).toMatch(/#0f172a/);
    expect(svg).toMatch(/Dark Elegant/);
  });

  test('enrichTheme adds preview thumb and tags', async () => {
    await themeLoader.syncInstalledThemes();
    const theme = await models.Theme.findOne({ where: { slug: 'myanmar-portal' } });
    expect(theme).toBeTruthy();
    const enriched = enrichTheme(theme, { assets: themeLoader.discoverThemeAssets('myanmar-portal') });
    expect(enriched.preview_thumb).toMatch(/\/themes\/myanmar-portal\/screenshot\.svg/);
    expect(enriched.has_static_screenshot).toBe(true);
    expect(enriched.tags).toEqual(expect.arrayContaining(['Portal']));
    expect(enriched.colors.primary).toBeTruthy();
  });

  test('getThemeManagerStats counts child themes', () => {
    const stats = getThemeManagerStats([
      { active: true, parent_slug: null },
      { active: false, parent_slug: 'classic-blog' }
    ]);
    expect(stats.total).toBe(2);
    expect(stats.childThemes).toBe(1);
  });
});

describe('themes admin UI routes', () => {
  test('theme thumbnail endpoint returns svg', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/themes/classic-blog/thumbnail').buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/svg/);
    const body = res.text || (Buffer.isBuffer(res.body) ? res.body.toString('utf8') : '');
    expect(body).toMatch(/<svg/);
  });

  test('themes json endpoint returns stats', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/themes.json');
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeTruthy();
    expect(Array.isArray(res.body.themes)).toBe(true);
  });

  test('sync themes route redirects', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, '/admin/themes');
    const res = await agent.post('/admin/themes/sync').type('form').send({ _csrf: csrf });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin/themes');
  });

  test('themes index shows redesigned UI', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/themes');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Sync from disk/i);
    expect(res.text).toMatch(/Installed themes/i);
    expect(res.text).toMatch(/screenshot\.svg|\/themes\//);
    expect(res.text).toMatch(/admin-themes\.js/);
  });

  test('theme detail page shows color swatches and overview', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/themes/classic-blog');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/At a glance/i);
    expect(res.text).toMatch(/theme-color-swatches/);
  });
});
