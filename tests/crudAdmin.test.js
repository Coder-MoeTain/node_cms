const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can create and publish a post with SEO fields', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/posts/create');
  const slug = `admin-post-${Date.now()}`;
  const response = await agent
    .post('/admin/posts')
    .type('form')
    .send({
      title: 'Admin Published Post',
      slug,
      content: '<p>Published content</p>',
      status: 'published',
      seo_title: 'SEO Title',
      seo_description: 'SEO Description',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const post = await models.Post.findOne({ where: { slug } });
  expect(post.status).toBe('published');
  expect(post.seo_title).toBe('SEO Title');
});

test('admin can manage categories', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const list = await agent.get('/admin/categories');
  expect(list.status).toBe(200);
  const csrf = await getCsrf(agent, '/admin/categories/create');
  const slug = `cat-${Date.now()}`;
  const response = await agent
    .post('/admin/categories')
    .type('form')
    .send({
      name: 'Test Category',
      slug,
      description: 'Category for tests',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const category = await models.Category.findOne({ where: { slug } });
  expect(category).toBeTruthy();
});

test('admin can bulk trash draft posts', async () => {
  const post = await models.Post.create({
    title: 'Bulk Trash Post',
    slug: `bulk-trash-${Date.now()}`,
    content: '<p>Trash</p>',
    status: 'draft',
    author_id: 1
  });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, '/admin/posts');
  const response = await agent
    .post('/admin/posts/bulk')
    .type('form')
    .send({ action: 'trash', ids: String(post.id), _csrf: csrf });
  expect(response.status).toBe(302);
  const gone = await models.Post.findByPk(post.id);
  expect(gone).toBeNull();
});

test('contact form accepts valid submission with CSRF', async () => {
  const agent = request.agent(app);
  const page = await agent.get('/contact');
  const csrf = page.text.match(/name="_csrf" value="([^"]+)"/)?.[1] || '';
  const response = await agent
    .post('/contact')
    .type('form')
    .send({
      name: 'Test User',
      email: 'contact@test.local',
      subject: 'Hello from tests',
      message: 'This is a valid contact message.',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const message = await models.ContactMessage.findOne({
    where: { email: 'contact@test.local', subject: 'Hello from tests' }
  });
  expect(message).toBeTruthy();
});

test('tag archive page responds', async () => {
  const [tag] = await models.Tag.findOrCreate({
    where: { slug: 'phase5-tag' },
    defaults: { name: 'Phase5 Tag', slug: 'phase5-tag' }
  });
  const response = await request(app).get(`/tag/${tag.slug}`);
  expect(response.status).toBe(200);
});
