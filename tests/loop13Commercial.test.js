const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf, ensureStandardTheme } = require('./helpers');
const { createZipArchive, themeTemplateFiles } = require('./helpers/zipFixtures');
const themeManager = require('../utils/themeManager');
const themeLoader = require('../utils/themeLoader');
const pluginLoader = require('../utils/pluginLoader');

describe('Loop 13 commercial quality', () => {
  describe('Autosave API shape', () => {
    test('GET /admin/autosave returns draft fields at top level', async () => {
      const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
      const post = await models.Post.create({
        title: 'Loop13 Autosave',
        slug: `loop13-autosave-${Date.now()}`,
        content: '<p>Base</p>',
        status: 'draft',
        post_type: 'post',
        author_id: admin.id
      });
      const agent = request.agent(app);
      await login(agent, 'admin@example.com', 'Admin@12345');
      const csrf = await getCsrf(agent, `/admin/posts/${post.id}/edit`);
      await agent.post(`/admin/autosave?_csrf=${encodeURIComponent(csrf)}`).send({
        resource_type: 'post',
        resource_id: post.id,
        draft_data: { title: 'Loop13 Draft Title', content: '<p>Draft</p>' }
      });
      const show = await agent.get(`/admin/autosave?resource_type=post&resource_id=${post.id}`);
      expect(show.status).toBe(200);
      expect(show.body.draft.title).toBe('Loop13 Draft Title');
      expect(show.body.draft.draft_data).toBeUndefined();
      expect(show.body.resource).toMatchObject({ updated_by: admin.id });
      expect(show.body.resource.updated_at).toBeTruthy();
    });

    test('custom_post autosave is accepted', async () => {
      const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
      const typeSlug = `loop13-cpt-${Date.now()}`;
      await models.CustomPostType.create({
        name: 'Loop13 CPT',
        slug: typeSlug,
        status: 'active',
        supports_title: true,
        supports_editor: true,
        show_in_api: true
      });
      const item = await models.Post.create({
        title: 'CPT Item',
        slug: `loop13-item-${Date.now()}`,
        content: '<p>CPT</p>',
        status: 'draft',
        post_type: typeSlug,
        author_id: admin.id
      });
      const agent = request.agent(app);
      await login(agent, 'admin@example.com', 'Admin@12345');
      const csrf = await getCsrf(agent, `/admin/content/${typeSlug}/${item.id}/edit`);
      const store = await agent.post(`/admin/autosave?_csrf=${encodeURIComponent(csrf)}`).send({
        resource_type: 'custom_post',
        resource_id: item.id,
        draft_data: { title: 'CPT Autosaved', content: '<p>Autosaved CPT</p>' }
      });
      expect(store.status).toBe(200);
      const show = await agent.get(`/admin/autosave?resource_type=custom_post&resource_id=${item.id}`);
      expect(show.body.draft.title).toBe('CPT Autosaved');
    });
  });

  describe('Reusable blocks HTTP API', () => {
    test('GET list and GET by slug return saved blocks', async () => {
      const agent = request.agent(app);
      await login(agent, 'admin@example.com', 'Admin@12345');
      const csrf = await getCsrf(agent, '/admin/posts/create');
      const save = await agent.post('/admin/api/reusable-blocks').set('X-CSRF-Token', csrf).send({
        title: 'Loop13 Hero',
        blocks: [{ type: 'heading', content: 'Loop13 Reusable', attrs: { level: 2 } }]
      });
      expect(save.status).toBe(201);
      const slug = save.body.data.slug;
      const list = await agent.get('/admin/api/reusable-blocks');
      expect(list.body.data.some((row) => row.slug === slug)).toBe(true);
      const detail = await agent.get(`/admin/api/reusable-blocks/${slug}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.blocks[0].content).toBe('Loop13 Reusable');
    });
  });

  describe('CPT API _embed', () => {
    test('returns _embedded author when requested', async () => {
      const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
      const typeSlug = `loop13-api-${Date.now()}`;
      await models.CustomPostType.create({
        name: 'Loop13 API Type',
        slug: typeSlug,
        status: 'active',
        supports_title: true,
        show_in_api: true
      });
      const slug = `loop13-api-item-${Date.now()}`;
      const item = await models.Post.create({
        title: 'Loop13 API Item',
        slug,
        content: '<p>API</p>',
        status: 'published',
        post_type: typeSlug,
        author_id: admin.id,
        published_at: new Date()
      });
      const res = await request(app).get(`/api/v1/types/${typeSlug}/content/${item.slug}?_embed=author`);
      expect(res.status).toBe(200);
      expect(res.body._embedded.author.email).toBe('admin@example.com');
    });
  });

  describe('Plugin detail tabs', () => {
    test('plugin show page renders tab navigation', async () => {
      await pluginLoader.syncInstalledPlugins();
      const plugin = await models.Plugin.findOne({ where: { slug: 'cookie-notice' } })
        || await models.Plugin.findOne({ order: [['id', 'ASC']] });
      expect(plugin).toBeTruthy();
      const agent = request.agent(app);
      await login(agent, 'admin@example.com', 'Admin@12345');
      const res = await agent.get(`/admin/plugins/${plugin.slug}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/np-plugin-tabs/);
      expect(res.text).toMatch(/plugin-pane-hooks/);
      expect(res.text).toMatch(/plugin-pane-migrations/);
    });
  });

  describe('Child theme ZIP without templates', () => {
    const PARENT = 'loop13-parent-theme';
    const CHILD = 'loop13-child-manifest';

    afterEach(async () => {
      await models.Theme.destroy({ where: { slug: [PARENT, CHILD] }, force: true });
      themeLoader.removeThemeDirectory(PARENT);
      themeLoader.removeThemeDirectory(CHILD);
    });

    test('installs child theme with manifest only when parent exists', async () => {
      const parentZip = path.join(os.tmpdir(), `${PARENT}-${Date.now()}.zip`);
      createZipArchive(themeTemplateFiles(PARENT), parentZip);
      await themeManager.installThemeFromArchive(parentZip);

      const childZip = path.join(os.tmpdir(), `${CHILD}-${Date.now()}.zip`);
      createZipArchive(themeTemplateFiles(CHILD, { parent: PARENT, manifestOnly: true }), childZip);
      const manifest = await themeManager.installThemeFromArchive(childZip);
      expect(manifest.parent).toBe(PARENT);
      expect(fs.existsSync(path.join(themeLoader.themesRoot, CHILD, 'theme.json'))).toBe(true);
      expect(fs.existsSync(path.join(themeLoader.themesRoot, CHILD, 'templates'))).toBe(false);
    });
  });

  describe('Standard archive layout', () => {
    beforeEach(async () => {
      await ensureStandardTheme(models);
      await models.SiteSetting.upsert({ key: 'show_utility_bar', value: 'true', group: 'general' });
      const [category] = await models.Category.findOrCreate({
        where: { slug: 'news' },
        defaults: { name: 'News', description: 'News' }
      });
      const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
      await models.Post.findOrCreate({
        where: { slug: 'loop13-archive-post' },
        defaults: {
          title: 'Loop13 Archive Post',
          slug: 'loop13-archive-post',
          content: '<p>Archive test</p>',
          status: 'published',
          post_type: 'post',
          author_id: admin.id,
          category_id: category.id,
          published_at: new Date()
        }
      });
    });

    test('category archive uses standard post grid and utility bar', async () => {
      const res = await request(app).get('/category/news');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/site-page/);
      expect(res.text).toMatch(/site-utility-bar/);
      expect(res.text).toMatch(/post-card|Loop13 Archive Post/);
    });
  });

  describe('Analytics Lite migration', () => {
    test('migration SQL file exists and plugin can record page views', async () => {
      const sqlPath = path.join(process.cwd(), 'plugins/analytics-lite/migrations/001_page_views.sql');
      expect(fs.existsSync(sqlPath)).toBe(true);
      await models.Plugin.findOrCreate({
        where: { slug: 'analytics-lite' },
        defaults: { name: 'Analytics Lite', slug: 'analytics-lite', version: '1.3.0', active: false }
      });
      await pluginLoader.runPluginMigrations('analytics-lite');
      const analytics = require('../plugins/analytics-lite/index.js');
      const req = { path: '/loop13-test', get: () => 'jest-agent' };
      await analytics.recordPageView(req);
      const count = await analytics.countRecentPageViews(1);
      expect(count).toBeGreaterThan(0);
    });
  });
});
