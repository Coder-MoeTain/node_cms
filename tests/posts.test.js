const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

let authorId;
let otherPostId;

beforeAll(async () => {
  const slugs = ['view_dashboard', 'create_posts', 'edit_posts', 'upload_media'];
  for (const slug of slugs) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const [authorRole] = await models.Role.findOrCreate({ where: { slug: 'author' }, defaults: { name: 'Author' } });
  const perms = await models.Permission.findAll({ where: { slug: slugs } });
  await authorRole.setPermissions(perms);

  const [author] = await models.User.findOrCreate({
    where: { email: 'author@example.com' },
    defaults: {
      name: 'Author User',
      email: 'author@example.com',
      password: await bcrypt.hash('Author@12345', 12),
      role_id: authorRole.id,
      status: 'active'
    }
  });
  authorId = author.id;

  const [otherUser] = await models.User.findOrCreate({
    where: { email: 'postother@test.local' },
    defaults: {
      name: 'Other Author',
      email: 'postother@test.local',
      password: await bcrypt.hash('Other@12345', 12),
      role_id: authorRole.id,
      status: 'active'
    }
  });

  const [ownPost] = await models.Post.findOrCreate({
    where: { slug: 'author-own-post-test' },
    defaults: {
      title: 'Author Own Post',
      slug: 'author-own-post-test',
      content: '<p>Own</p>',
      status: 'draft',
      author_id: authorId
    }
  });

  const [otherPost] = await models.Post.findOrCreate({
    where: { slug: 'other-user-post-test' },
    defaults: {
      title: 'Other User Post',
      slug: 'other-user-post-test',
      content: '<p>Other</p>',
      status: 'draft',
      author_id: otherUser.id
    }
  });
  otherPostId = otherPost.id;

  if (Number(ownPost.author_id) !== Number(authorId)) {
    await ownPost.update({ author_id: authorId });
  }
});

test('author can edit own post', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const own = await models.Post.findOne({ where: { slug: 'author-own-post-test' } });
  const edit = await agent.get(`/admin/posts/${own.id}/edit`);
  expect(edit.status).toBe(200);
});

test('author cannot edit another users post', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const edit = await agent.get(`/admin/posts/${otherPostId}/edit`);
  expect(edit.status).toBe(302);
  expect(edit.headers.location).toMatch(/posts/);
});

test('author cannot edit another users post via PUT', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .put(`/admin/posts/${otherPostId}`)
    .type('form')
    .send({ title: 'Stolen', content: '<p>Nope</p>', status: 'draft', _csrf: csrf });
  expect([302, 403]).toContain(response.status);
});

test('author quick draft creates draft post', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .post('/admin/quick-draft')
    .type('form')
    .send({ title: 'Quick Draft Test', content: 'Draft body', _csrf: csrf });
  expect(response.status).toBe(302);
  const draft = await models.Post.findOne({ where: { title: 'Quick Draft Test' } });
  expect(draft).toBeTruthy();
  expect(draft.status).toBe('draft');
  expect(Number(draft.author_id)).toBe(Number(authorId));
});
