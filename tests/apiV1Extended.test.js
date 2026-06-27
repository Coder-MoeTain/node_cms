const request = require('supertest');
const { app, models } = require('../server');

test('GET /api/v1/search returns posts and pages', async () => {
  const res = await request(app).get('/api/v1/search?q=welcome');
  expect(res.status).toBe(200);
  expect(res.body.data).toHaveProperty('posts');
  expect(res.body.data).toHaveProperty('pages');
});

test('GET /api/v1/pages lists published pages', async () => {
  const res = await request(app).get('/api/v1/pages');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});

test('GET /api/v1/taxonomies returns array', async () => {
  await models.Taxonomy.findOrCreate({
    where: { slug: 'topics' },
    defaults: { name: 'Topics', slug: 'topics', post_types: ['post'], status: 'active', show_in_api: true }
  });
  const res = await request(app).get('/api/v1/taxonomies');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});

test('GET /api/v1/menus returns menus', async () => {
  const res = await request(app).get('/api/v1/menus');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});

test('GET /api/v1/openapi.yaml serves spec', async () => {
  const res = await request(app).get('/api/v1/openapi.yaml');
  expect(res.status).toBe(200);
  expect(res.text).toMatch(/openapi:/);
});

test('permalink helper builds dated paths', async () => {
  const { buildPermalink } = require('../utils/permalinkHelper');
  const path = buildPermalink('/%year%/%month%/%slug%', { slug: 'hello', published_at: new Date('2026-06-15') });
  expect(path).toBe('/2026/06/hello');
});
