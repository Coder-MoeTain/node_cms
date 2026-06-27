const request = require('supertest');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { recordSlugChange, resolveSlugRedirect } = require('../utils/slugRedirectHelper');
const { buildPreviewUrl, canPreviewContent } = require('../utils/previewHelper');

let adminAgent;
let testPostId;

beforeAll(async () => {
  adminAgent = request.agent(app);
  await login(adminAgent, 'admin@example.com', 'Admin@12345');
});

test('creates post with SEO fields', async () => {
  const csrf = await getCsrf(adminAgent, '/admin/posts/create');
  const slug = `seo-post-${Date.now()}`;
  const res = await adminAgent
    .post(`/admin/posts?_csrf=${encodeURIComponent(csrf)}`)
    .type('form')
    .send({
      _csrf: csrf,
      title: 'SEO Test Post',
      slug,
      content: '<p>SEO body</p>',
      status: 'published',
      seo_title: 'Custom SEO Title',
      seo_description: 'Custom meta description',
      canonical_url: 'https://example.com/custom',
      og_title: 'OG Title',
      robots_noindex: 'on',
      sitemap_include: 'off'
    });

  expect(res.status).toBeLessThan(400);
  const post = await models.Post.findOne({ where: { slug } });
  expect(post).toBeTruthy();
  expect(post.seo_title).toBe('Custom SEO Title');
  expect(post.robots_noindex).toBe(true);
  expect(post.sitemap_include).toBe(false);
  testPostId = post.id;
});

test('handles duplicate slug with suffix', async () => {
  const csrf = await getCsrf(adminAgent, '/admin/posts/create');
  const base = `dup-slug-${Date.now()}`;
  await adminAgent.post(`/admin/posts?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    title: 'First',
    slug: base,
    content: '<p>1</p>',
    status: 'draft'
  });
  await adminAgent.post(`/admin/posts?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    title: 'Second',
    slug: base,
    content: '<p>2</p>',
    status: 'draft'
  });
  const posts = await models.Post.findAll({ where: { slug: { [Op.like]: `${base}%` } } });
  expect(posts.length).toBe(2);
  expect(new Set(posts.map((p) => p.slug)).size).toBe(2);
});

test('records old slug redirect on update', async () => {
  const csrf = await getCsrf(adminAgent, '/admin/posts/create');
  const oldSlug = `redirect-old-${Date.now()}`;
  const newSlug = `redirect-new-${Date.now()}`;
  const create = await adminAgent.post(`/admin/posts?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    title: 'Redirect Test',
    slug: oldSlug,
    content: '<p>R</p>',
    status: 'published'
  });
  expect(create.status).toBeLessThan(400);
  const post = await models.Post.findOne({ where: { slug: oldSlug } });
  const editCsrf = await getCsrf(adminAgent, `/admin/posts/${post.id}/edit`);
  await adminAgent
    .post(`/admin/posts/${post.id}?_method=PUT&_csrf=${encodeURIComponent(editCsrf)}`)
    .type('form')
    .send({ _csrf: editCsrf, title: 'Redirect Test', slug: newSlug, content: '<p>R</p>', status: 'published' });

  const redirect = await resolveSlugRedirect('post', oldSlug);
  expect(redirect).toBeTruthy();
  expect(redirect.url).toBe(`/post/${newSlug}`);
});

test('old slug redirects with 301 on public route', async () => {
  const oldSlug = `public-redirect-${Date.now()}`;
  const newSlug = `public-redirect-new-${Date.now()}`;
  const post = await models.Post.create({
    title: 'Public Redirect',
    slug: newSlug,
    content: '<p>x</p>',
    status: 'published',
    published_at: new Date()
  });
  await recordSlugChange('post', post.id, oldSlug, newSlug);
  const res = await request(app).get(`/post/${oldSlug}`);
  expect(res.status).toBe(301);
  expect(res.headers.location).toBe(`/post/${newSlug}`);
});

test('schedules post for future publishing', async () => {
  const csrf = await getCsrf(adminAgent, '/admin/posts/create');
  const slug = `scheduled-${Date.now()}`;
  const future = new Date(Date.now() + 86400000);
  const local = future.toISOString().slice(0, 16);
  await adminAgent.post(`/admin/posts?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    title: 'Scheduled Post',
    slug,
    content: '<p>Later</p>',
    status: 'scheduled',
    published_at: local
  });
  const post = await models.Post.findOne({ where: { slug } });
  expect(post.status).toBe('scheduled');
  expect(post.published_at).toBeTruthy();
});

test('trashes and restores post', async () => {
  const csrf = await getCsrf(adminAgent, '/admin/posts/create');
  const slug = `trash-${Date.now()}`;
  await adminAgent.post(`/admin/posts?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    title: 'Trash Me',
    slug,
    content: '<p>T</p>',
    status: 'draft'
  });
  const post = await models.Post.findOne({ where: { slug } });
  const delCsrf = await getCsrf(adminAgent, `/admin/posts/${post.id}/edit`);
  await adminAgent.post(`/admin/posts/${post.id}?_method=DELETE&_csrf=${encodeURIComponent(delCsrf)}`).send({ _csrf: delCsrf });
  const trashed = await models.Post.findByPk(post.id, { paranoid: false });
  expect(trashed.deleted_at).toBeTruthy();
  const restoreCsrf = await getCsrf(adminAgent, '/admin/posts?trashed=1');
  await adminAgent.post(`/admin/posts/${post.id}/restore?_csrf=${encodeURIComponent(restoreCsrf)}`).send({ _csrf: restoreCsrf });
  const restored = await models.Post.findByPk(post.id);
  expect(restored).toBeTruthy();
});

test('preview token allows draft access', async () => {
  const slug = `preview-${Date.now()}`;
  const post = await models.Post.create({
    title: 'Preview Draft',
    slug,
    content: '<p>draft</p>',
    status: 'draft',
    author_id: 1
  });
  const url = buildPreviewUrl('post', slug, post.id);
  expect(url).toContain('preview=');
  const res = await request(app).get(url);
  expect(res.status).toBe(200);
});

test('password protected post requires unlock', async () => {
  const slug = `protected-${Date.now()}`;
  const hash = await bcrypt.hash('Secret123!', 12);
  await models.Post.create({
    title: 'Protected',
    slug,
    content: '<p>hidden</p>',
    status: 'published',
    published_at: new Date(),
    post_password_hash: hash
  });
  const agent = request.agent(app);
  const locked = await agent.get(`/post/${slug}`);
  expect(locked.status).toBe(200);
  expect(locked.text).toMatch(/password/i);
  const csrfMatch = locked.text.match(/name="_csrf" value="([^"]+)"/);
  expect(csrfMatch).toBeTruthy();
  const unlocked = await agent.post(`/post/${slug}`).type('form').send({
    _csrf: csrfMatch[1],
    content_password: 'Secret123!'
  });
  expect([200, 302]).toContain(unlocked.status);
  const view = await agent.get(`/post/${slug}`);
  expect(view.status).toBe(200);
  expect(view.text).toMatch(/hidden/);
});

test('sitemap excludes noindex and includes lastmod', async () => {
  const slug = `sitemap-${Date.now()}`;
  await models.Post.create({
    title: 'Sitemap Post',
    slug,
    content: '<p>s</p>',
    status: 'published',
    published_at: new Date(),
    sitemap_include: false
  });
  const res = await request(app).get('/sitemap.xml');
  expect(res.status).toBe(200);
  expect(res.text).not.toContain(`/post/${slug}`);
  expect(res.text).toMatch(/<lastmod>/);
});

test('category stores SEO metadata', async () => {
  const csrf = await getCsrf(adminAgent, '/admin/categories/create');
  const slug = `cat-seo-${Date.now()}`;
  await adminAgent.post(`/admin/categories?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    name: 'SEO Category',
    slug,
    description: 'Desc',
    seo_title: 'Category SEO',
    seo_description: 'Category meta'
  });
  const cat = await models.Category.findOne({ where: { slug } });
  expect(cat.seo_title).toBe('Category SEO');
});
