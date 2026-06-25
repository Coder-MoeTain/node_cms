const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });
});

test('admin can list users', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/users');
  expect(response.status).toBe(200);
  expect(response.text).toMatch(/Users|Email/i);
});

test('admin can manage tags', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const list = await agent.get('/admin/tags');
  expect(list.status).toBe(200);
  const csrf = await getCsrf(agent, '/admin/tags/create');
  const slug = `tag-${Date.now()}`;
  const response = await agent
    .post('/admin/tags')
    .type('form')
    .send({ name: 'Test Tag', slug, description: 'Tag desc', _csrf: csrf });
  expect(response.status).toBe(302);
  const tag = await models.Tag.findOne({ where: { slug } });
  expect(tag).toBeTruthy();
});

test('admin can view messages inbox', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/messages');
  expect(response.status).toBe(200);
});

test('super admin can view roles list', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const response = await agent.get('/admin/roles');
  expect(response.status).toBe(200);
});

test('admin can view menus and banners', async () => {
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const menus = await agent.get('/admin/menus');
  expect(menus.status).toBe(200);
  const banners = await agent.get('/admin/banners');
  expect(banners.status).toBe(200);
  const sliders = await agent.get('/admin/sliders');
  expect(sliders.status).toBe(200);
});

test('admin can edit and approve a comment', async () => {
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' } });
  const post = await models.Post.create({
    title: 'Comment Test Post',
    slug: `comment-test-${Date.now()}`,
    content: '<p>Comments</p>',
    status: 'published',
    author_id: admin.id
  });
  const comment = await models.Comment.create({
    post_id: post.id,
    name: 'Moderation Test',
    email: 'mod@test.local',
    content: 'Pending comment',
    status: 'pending'
  });
  const agent = request.agent(app);
  await login(agent, 'admin@example.com', 'Admin@12345');
  const csrf = await getCsrf(agent, `/admin/comments/${comment.id}/edit`);
  const response = await agent
    .put(`/admin/comments/${comment.id}`)
    .type('form')
    .send({ status: 'approved', content: 'Pending comment', _csrf: csrf });
  expect(response.status).toBe(302);
  await comment.reload();
  expect(comment.status).toBe('approved');
  await comment.destroy({ force: true });
  await post.destroy({ force: true });
});
