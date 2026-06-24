const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');

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
    where: { email: 'public@test.local' },
    defaults: {
      name: 'Public Author',
      email: 'public@test.local',
      password: await bcrypt.hash('Public@12345', 12),
      role_id: role.id,
      status: 'active'
    }
  });

  await models.Post.findOrCreate({
    where: { slug: 'welcome-post-test' },
    defaults: {
      title: 'Welcome Post',
      slug: 'welcome-post-test',
      content: '<p>Hello world</p>',
      status: 'published',
      author_id: author.id,
      category_id: category.id,
      published_at: new Date()
    }
  });

  await models.Page.findOrCreate({
    where: { slug: 'about-test' },
    defaults: {
      title: 'About',
      slug: 'about-test',
      content: '<p>About us</p>',
      status: 'published'
    }
  });
});

test('home page responds', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
});

test('blog archive responds', async () => {
  const response = await request(app).get('/blog');
  expect(response.status).toBe(200);
});

test('published post page responds', async () => {
  const response = await request(app).get('/post/welcome-post-test');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Welcome Post/);
});

test('published page responds', async () => {
  const response = await request(app).get('/page/about-test');
  expect(response.status).toBe(200);
});

test('search page responds', async () => {
  const response = await request(app).get('/search?q=welcome');
  expect(response.status).toBe(200);
});

test('category archive responds', async () => {
  const response = await request(app).get('/category/news');
  expect(response.status).toBe(200);
});

test('sitemap and robots respond', async () => {
  const sitemap = await request(app).get('/sitemap.xml');
  expect(sitemap.status).toBe(200);
  const robots = await request(app).get('/robots.txt');
  expect(robots.status).toBe(200);
});

test('contact page responds', async () => {
  const response = await request(app).get('/contact');
  expect(response.status).toBe(200);
});
