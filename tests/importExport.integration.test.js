const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { exportSite } = require('../utils/exporter');
const { previewImport, importSite } = require('../utils/importer');

describe('Import / export with real data', () => {
  const importSlug = `imported-post-${Date.now()}`;
  const categorySlug = `imported-cat-${Date.now()}`;
  let seedPostId;

  beforeAll(async () => {
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const [post] = await models.Post.findOrCreate({
      where: { slug: 'export-seed-post' },
      defaults: {
        title: 'Export Seed Post',
        slug: 'export-seed-post',
        content: '<p>seed</p>',
        status: 'published',
        post_type: 'post',
        author_id: admin?.id
      }
    });
    seedPostId = post.id;
  });

  test('exportSite includes live posts and pages from database', async () => {
    const payload = await exportSite({ includeMedia: false });
    expect(payload.version).toBe('1.1');
    expect(Array.isArray(payload.posts)).toBe(true);
    expect(payload.posts.some((row) => row.id === seedPostId || row.slug === 'export-seed-post')).toBe(true);
    expect(Array.isArray(payload.pages)).toBe(true);
  });

  test('previewImport and dry-run import do not write records', async () => {
    const data = {
      version: '1.0',
      categories: [{ name: 'Dry Cat', slug: `${categorySlug}-dry`, description: '' }],
      posts: [{
        title: 'Dry Run Post',
        slug: `${importSlug}-dry`,
        content: '<p>dry</p>',
        status: 'published',
        post_type: 'post'
      }]
    };
    const summary = await previewImport(data);
    expect(summary.categories).toBe(1);
    expect(summary.posts).toBe(1);

    const result = await importSite(data, { dryRun: true });
    expect(result.dryRun).toBe(true);
    const cat = await models.Category.findOne({ where: { slug: `${categorySlug}-dry` } });
    expect(cat).toBeNull();
  });

  test('importSite writes categories and posts from export payload', async () => {
    const data = {
      version: '1.0',
      categories: [{ name: 'Imported Category', slug: categorySlug, description: 'From test' }],
      posts: [{
        title: 'Imported Post Title',
        slug: importSlug,
        content: '<p>Imported body content</p>',
        status: 'published',
        post_type: 'post'
      }],
      pages: []
    };

    const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const result = await importSite(data, { dryRun: false, userId: admin.id });
    expect(result.logs.some((line) => line.includes(importSlug))).toBe(true);

    const post = await models.Post.findOne({ where: { slug: importSlug, post_type: 'post' } });
    expect(post).toBeTruthy();
    expect(post.title).toBe('Imported Post Title');

    const publicPost = await request(app).get(`/post/${importSlug}`);
    expect(publicPost.status).toBe(200);
    expect(publicPost.text).toMatch(/Imported body content/);
  });

  test('admin export download returns JSON attachment', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/tools/export/download?media=0');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    const data = JSON.parse(res.text);
    expect(data.version).toBe('1.1');
  });

  test('CLI export writes JSON file to disk', async () => {
    const { execFileSync } = require('child_process');
    const out = path.join(os.tmpdir(), `nodepress-export-${Date.now()}.json`);
    execFileSync(process.execPath, ['bin/nodepress', 'export', out], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test', DOTENV_CONFIG_QUIET: 'true' },
      stdio: 'pipe'
    });
    expect(fs.existsSync(out)).toBe(true);
    const data = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(data.version).toBe('1.1');
    fs.unlinkSync(out);
  });

  test('admin import preview accepts uploaded JSON', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const tmp = path.join(os.tmpdir(), `upload-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ version: '1.0', posts: [{ slug: 'x' }], pages: [] }));

    const csrf = await getCsrf(agent, '/admin/tools/import');
    const res = await agent.post(`/admin/tools/import/preview?_csrf=${encodeURIComponent(csrf)}`)
      .attach('file', tmp, { contentType: 'application/json', filename: 'import.json' });
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/posts/i);
    fs.unlinkSync(tmp);
  });
});
