const request = require('supertest');
const bcrypt = require('bcrypt');
const {
  buildDesignTokensBlock,
  parseDesignTokens,
  stripManagedBlocks
} = require('../utils/portalConfig');
const { app, models } = require('../server');
const { ensurePortalTheme } = require('./helpers');

describe('public UI phases 6–17', () => {
  beforeAll(async () => {
    const [category] = await models.Category.findOrCreate({
      where: { slug: 'news' },
      defaults: { name: 'News', description: 'News' }
    });
    const [role] = await models.Role.findOrCreate({
      where: { slug: 'subscriber' },
      defaults: { name: 'Subscriber' }
    });
    const [author] = await models.User.findOrCreate({
      where: { email: 'public-ui@test.local' },
      defaults: {
        name: 'Public UI Author',
        email: 'public-ui@test.local',
        password: await bcrypt.hash('Public@12345', 12),
        role_id: role.id,
        status: 'active'
      }
    });
    await models.Post.findOrCreate({
      where: { slug: 'public-ui-post' },
      defaults: {
        title: 'Public UI Post',
        slug: 'public-ui-post',
        content: '<p>Public UI content</p>',
        status: 'published',
        author_id: author.id,
        category_id: category.id,
        published_at: new Date()
      }
    });
    await models.Page.findOrCreate({
      where: { slug: 'public-ui-page' },
      defaults: {
        title: 'Public UI Page',
        slug: 'public-ui-page',
        content: '<p>Public UI page content</p>',
        status: 'published'
      }
    });
  });

  beforeEach(async () => {
    await ensurePortalTheme(models);
  });

  test('blog page uses shared inner page header', async () => {
    const response = await request(app).get('/blog');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/inner-page-header|site-page-header|portal-page-header/);
    expect(response.text).toMatch(/Skip to main content/);
    expect(response.text).toMatch(/site-design-system/);
  });

  test('search page includes accessible results label', async () => {
    const response = await request(app).get('/search?q=welcome');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/role="search"/);
    expect(response.text).toMatch(/aria-live="polite"/);
  });

  test('contact page uses modern widget panels', async () => {
    const response = await request(app).get('/contact');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/Contact Us/);
    expect(response.text).toMatch(/site-widget|portal-widget/);
  });

  test('post page includes reading progress and action toolbar', async () => {
    const response = await request(app).get('/post/public-ui-post');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/data-reading-progress/);
    expect(response.text).toMatch(/data-copy-url/);
    expect(response.text).toMatch(/data-share-post/);
    expect(response.text).toMatch(/data-print-page/);
    expect(response.text).toMatch(/post-reading-progress/);
  });

  test('static page uses content panel and page header', async () => {
    const response = await request(app).get('/page/public-ui-page');
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/content-page|portal-page-content/);
    expect(response.text).toMatch(/inner-page-header|site-page-header/);
  });

  test('public pages load site-pages stylesheet', async () => {
    const response = await request(app).get('/blog');
    expect(response.text).toMatch(/\/css\/site-pages\.css/);
  });

  test('design token helpers round-trip in custom CSS', () => {
    const block = buildDesignTokensBlock({ radius: 'rounded', shadow: 'strong', spacing: 'spacious' });
    const css = `${block}\n.custom { color: red; }`;
    const parsed = parseDesignTokens(css);
    expect(parsed.radius).toBe('rounded');
    expect(parsed.shadow).toBe('strong');
    expect(parsed.spacing).toBe('spacious');
    const stripped = stripManagedBlocks(css);
    expect(stripped).not.toContain('np-design-tokens');
    expect(stripped).toContain('.custom');
  });

  test('dark mode body class when theme setting enabled', async () => {
    const setting = await models.ThemeSetting.findOne({ where: { active: true } });
    if (!setting) return;
    await setting.update({ dark_mode: true });
    const response = await request(app).get('/blog');
    expect(response.text).toMatch(/theme-dark/);
    await setting.update({ dark_mode: false });
  });
});
