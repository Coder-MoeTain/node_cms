const request = require('supertest');
const { app } = require('../server');
const { login } = require('./helpers');

describe('Admin content search API', () => {
  test('GET /admin/api/search requires auth and returns JSON', async () => {
    const guest = await request(app).get('/admin/api/search?q=test');
    expect(guest.status).toBe(302);

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/api/search?q=post').set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('posts');
    expect(res.body.data).toHaveProperty('pages');
    expect(res.body.data).toHaveProperty('media');
    expect(res.body.data).toHaveProperty('customPosts');
    expect(Array.isArray(res.body.data.customPosts)).toBe(true);
  });

  test('search includes custom post type content when permitted', async () => {
    const admin = await require('../models').User.findOne({ where: { email: 'admin@example.com' } });
    const typeSlug = `search-cpt-${Date.now()}`;
    await require('../models').CustomPostType.create({
      name: 'Search CPT',
      slug: typeSlug,
      status: 'active',
      supports_title: true
    });
    await require('../models').Post.create({
      title: 'UniqueSearchCptTitleXYZ',
      slug: `unique-search-cpt-${Date.now()}`,
      content: '<p>x</p>',
      status: 'published',
      post_type: typeSlug,
      author_id: admin.id,
      published_at: new Date()
    });
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const res = await agent.get('/admin/api/search?q=UniqueSearchCptTitleXYZ').set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.data.customPosts.some((row) => row.title === 'UniqueSearchCptTitleXYZ')).toBe(true);
  });
});
