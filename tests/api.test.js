const request = require('supertest');
const { app } = require('../server');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('apiAuth middleware', () => {
  const originalKey = process.env.API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalKey;
    jest.resetModules();
  });

  test('allows requests when API_KEY is not configured', () => {
    delete process.env.API_KEY;
    const { apiAuth } = require('../middleware/apiAuth');
    const next = jest.fn();
    apiAuth({ get: () => null, query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects requests without a valid key', () => {
    process.env.API_KEY = 'secret-key';
    const { apiAuth } = require('../middleware/apiAuth');
    const next = jest.fn();
    const res = mockRes();
    apiAuth({ get: () => null, query: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts key from X-API-Key header', () => {
    process.env.API_KEY = 'secret-key';
    const { apiAuth } = require('../middleware/apiAuth');
    const next = jest.fn();
    apiAuth({ get: (name) => (name === 'x-api-key' ? 'secret-key' : null), query: {} }, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('REST API routes', () => {
  beforeAll(async () => {
    const bcrypt = require('bcrypt');
    const [category] = await require('../server').models.Category.findOrCreate({
      where: { slug: 'api-news' },
      defaults: { name: 'API News', description: 'API test category' }
    });
    const [role] = await require('../server').models.Role.findOrCreate({
      where: { slug: 'api-author' },
      defaults: { name: 'API Author' }
    });
    const [author] = await require('../server').models.User.findOrCreate({
      where: { email: 'api-author@test.local' },
      defaults: {
        name: 'API Author',
        email: 'api-author@test.local',
        password: await bcrypt.hash('ApiAuthor@12345', 12),
        role_id: role.id,
        status: 'active'
      }
    });
    await require('../server').models.Post.findOrCreate({
      where: { slug: 'api-published-post' },
      defaults: {
        title: 'API Published Post',
        slug: 'api-published-post',
        content: '<p>API</p>',
        status: 'published',
        author_id: author.id,
        category_id: category.id,
        published_at: new Date()
      }
    });
    await require('../server').models.Page.findOrCreate({
      where: { slug: 'api-published-page' },
      defaults: {
        title: 'API Published Page',
        slug: 'api-published-page',
        content: '<p>API page</p>',
        status: 'published'
      }
    });
  });

  test('GET /api/posts returns published posts', async () => {
    const response = await request(app).get('/api/posts');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.some((post) => post.slug === 'api-published-post')).toBe(true);
  });

  test('GET /api/posts/:slug returns a single post', async () => {
    const response = await request(app).get('/api/posts/api-published-post');
    expect(response.status).toBe(200);
    expect(response.body.slug).toBe('api-published-post');
  });

  test('GET /api/posts/:slug returns 404 for missing post', async () => {
    const response = await request(app).get('/api/posts/does-not-exist-api-slug');
    expect(response.status).toBe(404);
  });

  test('GET /api/pages/:slug returns a published page', async () => {
    const response = await request(app).get('/api/pages/api-published-page');
    expect(response.status).toBe(200);
    expect(response.body.slug).toBe('api-published-page');
  });

  test('GET /api/categories returns categories', async () => {
    const response = await request(app).get('/api/categories');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('unknown API route returns 404 JSON', async () => {
    const response = await request(app).get('/api/unknown-endpoint');
    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });
});
