const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm } = require('./helpers');
const { parseWxr, previewWxrImport, isWxrDocument } = require('../utils/wxrImporter');
const { importSite } = require('../utils/importer');

const fixturePath = path.join(__dirname, 'fixtures', 'sample.wxr.xml');

describe('WordPress WXR import', () => {
  test('isWxrDocument detects WordPress export XML', () => {
    const raw = fs.readFileSync(fixturePath, 'utf8');
    expect(isWxrDocument(raw)).toBe(true);
    expect(isWxrDocument('{"version":"1.0"}')).toBe(false);
  });

  test('parseWxr maps posts, pages, categories, and tags', () => {
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const payload = parseWxr(raw);
    expect(payload.posts).toHaveLength(1);
    expect(payload.pages).toHaveLength(1);
    expect(payload.posts[0].slug).toBe('hello-wxr-world');
    expect(payload.posts[0].status).toBe('published');
    expect(payload.pages[0].slug).toBe('about-us');
    expect(payload.categories.some((row) => row.slug === 'news')).toBe(true);
    expect(payload.tags.some((row) => row.slug === 'wxr')).toBe(true);
    expect(payload.media).toHaveLength(1);
    expect(payload.media[0].source_url).toMatch(/hero\.jpg/);
  });

  test('previewWxrImport returns counts without writing records', async () => {
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const result = await previewWxrImport(raw);
    expect(result.preview.posts).toBe(1);
    expect(result.preview.pages).toBe(1);
    expect(result.preview.categories).toBe(1);
    expect(result.preview.media).toBe(1);
    expect(result.itemCount).toBe(4);
  });

  test('importSite can import converted WXR payload', async () => {
    const slug = `wxr-post-${Date.now()}`;
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const payload = parseWxr(raw);
    payload.posts[0].slug = slug;

    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    await importSite(payload, { dryRun: false, userId: admin.id });

    const post = await models.Post.findOne({ where: { slug, post_type: 'post' } });
    expect(post).toBeTruthy();
    expect(post.title).toBe('Hello WXR World');
  });

  test('admin import preview accepts uploaded WXR file', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const csrf = await getCsrf(agent, '/admin/tools/import');
    const res = await agent.post(`/admin/tools/import/preview?_csrf=${encodeURIComponent(csrf)}`)
      .attach('file', fixturePath, { contentType: 'application/xml', filename: 'sample.wxr.xml' });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/posts/i);
    expect(res.text).toMatch(/wxr_items/i);
  });
});
