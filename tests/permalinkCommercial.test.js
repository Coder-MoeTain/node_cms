const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');

let testPost;

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
    where: { email: 'permalink@test.local' },
    defaults: {
      name: 'Permalink Author',
      email: 'permalink@test.local',
      password: await bcrypt.hash('Permalink@12345', 12),
      role_id: role.id,
      status: 'active'
    }
  });
  [testPost] = await models.Post.findOrCreate({
    where: { slug: 'permalink-test-post' },
    defaults: {
      title: 'Permalink Test Post',
      slug: 'permalink-test-post',
      content: '<p>Permalink body</p>',
      status: 'published',
      author_id: author.id,
      category_id: category.id,
      published_at: new Date('2026-06-15T12:00:00Z')
    }
  });
});

afterEach(async () => {
  await models.SiteSetting.upsert({ key: 'permalink_structure', value: '/post/%slug%', group: 'seo' });
  await models.SiteSetting.upsert({ key: 'page_permalink_structure', value: '/page/%slug%', group: 'seo' });
});

test('custom permalink structure resolves dated post URLs', async () => {
  await models.SiteSetting.upsert({
    key: 'permalink_structure',
    value: '/%year%/%month%/%slug%',
    group: 'seo'
  });

  const res = await request(app).get('/2026/06/permalink-test-post');
  expect(res.status).toBe(200);
  expect(res.text).toMatch(/Permalink Test Post/);
});

test('postUrl helper uses permalink settings from site context', async () => {
  await models.SiteSetting.upsert({
    key: 'permalink_structure',
    value: '/articles/%slug%',
    group: 'seo'
  });

  const res = await request(app).get('/');
  expect(res.status).toBe(200);
  expect(res.text).toMatch('/articles/permalink-test-post');
});

test('taxonomy term archive lists assigned posts', async () => {
  const [taxonomy] = await models.Taxonomy.findOrCreate({
    where: { slug: 'topics' },
    defaults: {
      name: 'Topics',
      slug: 'topics',
      post_types: ['post'],
      status: 'active',
      public: true,
      show_in_api: true
    }
  });
  const [term] = await models.TaxonomyTerm.findOrCreate({
    where: { taxonomy_id: taxonomy.id, slug: 'featured' },
    defaults: {
      taxonomy_id: taxonomy.id,
      name: 'Featured',
      slug: 'featured'
    }
  });
  await testPost.setTaxonomyTerms([term.id]);

  const res = await request(app).get('/taxonomy/topics/featured');
  expect(res.status).toBe(200);
  expect(res.text).toMatch(/Permalink Test Post/);
});
