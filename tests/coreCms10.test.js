const request = require('supertest');
const { Op } = require('sequelize');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm, TEST_IMAGE } = require('./helpers');
const { searchPosts, searchPages } = require('../utils/searchHelper');
const { saveRevision, getRevisionLimit } = require('../utils/revisionHelper');
const { validateCommentParent } = require('../utils/commentDepthHelper');
const { exportSite } = require('../utils/exporter');
const { importSite } = require('../utils/importer');

let adminAgent;

beforeAll(async () => {
  adminAgent = request.agent(app);
  await login(adminAgent, 'admin@example.com', 'Admin@12345');
});

test('searchHelper finds posts via FULLTEXT or fallback', async () => {
  await models.Post.findOrCreate({
    where: { slug: 'fulltext-search-target' },
    defaults: {
      title: 'Unique Fulltext Target',
      slug: 'fulltext-search-target',
      content: '<p>zzuniquefulltexttoken</p>',
      excerpt: 'zzuniquefulltexttoken',
      status: 'published',
      post_type: 'post',
      published_at: new Date()
    }
  });
  const result = await searchPosts('zzuniquefulltexttoken', { limit: 5 });
  expect(result.rows.some((row) => row.slug === 'fulltext-search-target')).toBe(true);
});

test('searchHelper finds pages', async () => {
  await models.Page.findOrCreate({
    where: { slug: 'fulltext-page-target' },
    defaults: {
      title: 'Fulltext Page Target',
      slug: 'fulltext-page-target',
      content: '<p>zzuniquepagetoken</p>',
      status: 'published',
      published_at: new Date()
    }
  });
  const pages = await searchPages('zzuniquepagetoken');
  expect(pages.some((row) => row.slug === 'fulltext-page-target')).toBe(true);
});

test('public search uses search helper', async () => {
  const res = await request(app).get('/search?q=welcome');
  expect(res.status).toBe(200);
});

test('page hierarchy parent_id saves via admin', async () => {
  const parentSlug = `parent-page-${Date.now()}`;
  const childSlug = `child-page-${Date.now()}`;
  const csrf = await getCsrf(adminAgent, '/admin/pages/create');
  await adminAgent.post(`/admin/pages?_csrf=${encodeURIComponent(csrf)}`).type('form').send({
    _csrf: csrf,
    title: 'Parent Page',
    slug: parentSlug,
    content: '<p>Parent</p>',
    status: 'published'
  });
  const parent = await models.Page.findOne({ where: { slug: parentSlug } });
  const csrf2 = await getCsrf(adminAgent, '/admin/pages/create');
  await adminAgent.post(`/admin/pages?_csrf=${encodeURIComponent(csrf2)}`).type('form').send({
    _csrf: csrf2,
    title: 'Child Page',
    slug: childSlug,
    content: '<p>Child</p>',
    status: 'published',
    parent_id: parent.id,
    menu_order: 2
  });
  const child = await models.Page.findOne({ where: { slug: childSlug } });
  expect(child.parent_id).toBe(parent.id);
  expect(child.menu_order).toBe(2);
});

test('API assigns taxonomy terms to posts', async () => {
  const [taxonomy] = await models.Taxonomy.findOrCreate({
    where: { slug: 'api-topics' },
    defaults: { name: 'API Topics', slug: 'api-topics', status: 'active', show_in_api: true }
  });
  const [term] = await models.TaxonomyTerm.findOrCreate({
    where: { taxonomy_id: taxonomy.id, slug: 'api-featured' },
    defaults: { taxonomy_id: taxonomy.id, name: 'API Featured', slug: 'api-featured' }
  });
  const slug = `api-tax-post-${Date.now()}`;
  const create = await adminAgent
    .post('/api/v1/posts')
    .send({
      title: 'API Tax Post',
      slug,
      content: '<p>T</p>',
      status: 'published',
      taxonomy_terms: [term.id]
    });
  expect(create.status).toBe(201);
  const get = await request(app).get(`/api/v1/posts/${slug}`);
  expect(get.status).toBe(200);
  expect(get.body.data.taxonomyTerms.some((t) => t.id === term.id)).toBe(true);
});

test('widgets API returns instances', async () => {
  const res = await request(app).get('/api/v1/widgets');
  expect(res.status).toBe(200);
  const area = res.body.data[0];
  expect(area).toHaveProperty('widgets');
});

test('menus API returns nested itemsTree', async () => {
  const res = await request(app).get('/api/v1/menus');
  expect(res.status).toBe(200);
  if (res.body.data.length) {
    expect(Array.isArray(res.body.data[0].itemsTree)).toBe(true);
  }
});

test('comment max depth rejects deep replies', async () => {
  await models.SiteSetting.upsert({ key: 'comment_max_depth', value: '2', group: 'general' });
  const post = await models.Post.findOne({ where: { status: 'published', post_type: 'post' } });
  const root = await models.Comment.create({
    post_id: post.id,
    name: 'Root',
    email: 'root@test.local',
    content: 'root',
    status: 'approved'
  });
  const child = await models.Comment.create({
    post_id: post.id,
    parent_id: root.id,
    name: 'Child',
    email: 'child@test.local',
    content: 'child',
    status: 'approved'
  });
  const grandchild = await models.Comment.create({
    post_id: post.id,
    parent_id: child.id,
    name: 'Grandchild',
    email: 'grand@test.local',
    content: 'grand',
    status: 'approved'
  });
  const check = await validateCommentParent(grandchild.id, post.id);
  expect(check.valid).toBe(false);
  await models.SiteSetting.upsert({ key: 'comment_max_depth', value: '5', group: 'general' });
});

test('revision pruning respects revision_limit', async () => {
  await models.SiteSetting.upsert({ key: 'revision_limit', value: '3', group: 'general' });
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
  const post = await models.Post.create({
    title: 'Revision Prune',
    slug: `revision-prune-${Date.now()}`,
    content: '<p>0</p>',
    status: 'draft',
    post_type: 'post',
    author_id: admin.id
  });
  for (let i = 1; i <= 5; i += 1) {
    await saveRevision('post', post.id, { title: 'Revision Prune', content: `<p>${i}</p>` }, admin.id);
  }
  const rows = await models.Revision.findAll({
    where: { resource_type: 'post', resource_id: post.id },
    order: [['created_at', 'DESC']]
  });
  expect(rows.length).toBeLessThanOrEqual(3);
  await models.SiteSetting.upsert({ key: 'revision_limit', value: '25', group: 'general' });
});

test('export and import includes taxonomies and media keys', async () => {
  const payload = await exportSite({ includeMedia: true });
  expect(payload).toHaveProperty('taxonomies');
  expect(payload).toHaveProperty('post_taxonomy_terms');
  expect(payload).toHaveProperty('media');
  const preview = await importSite(payload, { dryRun: true });
  expect(preview.summary.taxonomies).toBeGreaterThanOrEqual(0);
});

test('API PUT settings accepts revision_limit and comment_max_depth', async () => {
  const res = await adminAgent
    .put('/api/v1/settings')
    .send({ revision_limit: '20', comment_max_depth: '4' });
  expect(res.status).toBe(200);
  expect(res.body.data.updated).toEqual(expect.arrayContaining(['revision_limit', 'comment_max_depth']));
  const limit = await getRevisionLimit();
  expect(limit).toBe(20);
});
