const request = require('supertest');
const { app, models } = require('../server');
const { login } = require('./helpers');

describe('API v1', () => {
  let pageSlug;

  beforeAll(async () => {
    pageSlug = `api-v1-page-${Date.now()}`;
    await models.Page.findOrCreate({
      where: { slug: pageSlug },
      defaults: {
        title: 'API V1 Page',
        slug: pageSlug,
        content: '<p>API page</p>',
        status: 'published'
      }
    });
  });

  test('GET /api/v1/pages/:slug returns published page', async () => {
    const res = await request(app).get(`/api/v1/pages/${pageSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(pageSlug);
  });

  test('POST /api/v1/pages creates page with authenticated session', async () => {
    const slug = `api-v1-new-${Date.now()}`;
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');

    const res = await agent
      .post('/api/v1/pages')
      .send({ title: 'Created via API', slug, content: '<p>API</p>', status: 'draft' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(slug);
    await models.Page.destroy({ where: { slug }, force: true });
  });

  test('GET /api/v1/comments returns approved comments', async () => {
    const res = await request(app).get('/api/v1/comments');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('DELETE /api/v1/pages/:slug removes page', async () => {
    const slug = `api-v1-del-${Date.now()}`;
    await models.Page.create({
      title: 'Delete Me',
      slug,
      content: '<p>x</p>',
      status: 'draft'
    });
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.delete(`/api/v1/pages/${slug}`);
    expect(res.status).toBe(200);
    const gone = await models.Page.findOne({ where: { slug }, paranoid: false });
    expect(gone.deleted_at).toBeTruthy();
    await models.Page.destroy({ where: { slug }, force: true });
  });
});
