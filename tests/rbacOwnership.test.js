const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

let authorId;
let otherAuthorId;
let ownPostId;
let otherPostId;
let ownMediaId;
let otherMediaId;

beforeAll(async () => {
  const slugs = [
    'view_dashboard', 'create_posts', 'edit_posts', 'upload_media', 'publish_posts', 'delete_posts'
  ];
  for (const slug of slugs) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }

  const [authorRole] = await models.Role.findOrCreate({ where: { slug: 'author' }, defaults: { name: 'Author' } });
  const authorPerms = await models.Permission.findAll({
    where: { slug: ['view_dashboard', 'create_posts', 'edit_posts', 'upload_media'] }
  });
  await authorRole.setPermissions(authorPerms);

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

  const [otherAuthor] = await models.User.findOrCreate({
    where: { email: 'rbacother@test.local' },
    defaults: {
      name: 'Other Author',
      email: 'rbacother@test.local',
      password: await bcrypt.hash('Other@12345', 12),
      role_id: authorRole.id,
      status: 'active'
    }
  });
  otherAuthorId = otherAuthor.id;

  const [ownPost] = await models.Post.findOrCreate({
    where: { slug: 'rbac-own-post' },
    defaults: {
      title: 'RBAC Own Post',
      slug: 'rbac-own-post',
      content: '<p>Own</p>',
      status: 'draft',
      author_id: authorId
    }
  });
  ownPostId = ownPost.id;

  const [otherPost] = await models.Post.findOrCreate({
    where: { slug: 'rbac-other-post' },
    defaults: {
      title: 'RBAC Other Post',
      slug: 'rbac-other-post',
      content: '<p>Other</p>',
      status: 'draft',
      author_id: otherAuthorId
    }
  });
  otherPostId = otherPost.id;

  const [ownMedia] = await models.Media.findOrCreate({
    where: { original_name: 'rbac-own-media.jpg' },
    defaults: {
      original_name: 'rbac-own-media.jpg',
      filename: 'rbac-own-media.jpg',
      file_path: '/uploads/rbac-own-media.jpg',
      file_type: 'image',
      mime_type: 'image/jpeg',
      file_size: 1024,
      uploaded_by: authorId
    }
  });
  ownMediaId = ownMedia.id;

  const [otherMedia] = await models.Media.findOrCreate({
    where: { original_name: 'rbac-other-media.jpg' },
    defaults: {
      original_name: 'rbac-other-media.jpg',
      filename: 'rbac-other-media.jpg',
      file_path: '/uploads/rbac-other-media.jpg',
      file_type: 'image',
      mime_type: 'image/jpeg',
      file_size: 1024,
      uploaded_by: otherAuthorId
    }
  });
  otherMediaId = otherMedia.id;

  await models.User.update({ force_password_change: false }, { where: { email: 'author@example.com' } });
});

test('author posts list excludes other authors posts', async () => {
  await models.Post.update({ author_id: authorId }, { where: { id: ownPostId } });
  await models.Post.update({ author_id: otherAuthorId }, { where: { id: otherPostId } });
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const page = await agent.get('/admin/posts?q=rbac-own');
  expect(page.status).toBe(200);
  expect(page.text).toMatch(/RBAC Own Post/);
  expect(page.text).not.toMatch(/RBAC Other Post/);
});

test('author cannot update another users post', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .put(`/admin/posts/${otherPostId}`)
    .type('form')
    .send({ title: 'Hijacked', content: '<p>No</p>', status: 'draft', _csrf: csrf });
  expect([302, 403]).toContain(response.status);
  const post = await models.Post.findByPk(otherPostId);
  expect(post.title).toBe('RBAC Other Post');
});

test('author cannot publish own post without publish_posts', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .put(`/admin/posts/${ownPostId}`)
    .type('form')
    .send({
      title: 'RBAC Own Post',
      content: '<p>Own</p>',
      status: 'published',
      _csrf: csrf
    });
  expect(response.status).toBe(302);
  const post = await models.Post.findByPk(ownPostId);
  expect(post.status).toBe('draft');
});

test('author cannot delete own post without delete_posts', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .delete(`/admin/posts/${ownPostId}`)
    .type('form')
    .send({ _csrf: csrf });
  expect([302, 403]).toContain(response.status);
  const post = await models.Post.findByPk(ownPostId);
  expect(post).toBeTruthy();
});

test('author can edit own media but not others', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const ownEdit = await agent.get(`/admin/media/${ownMediaId}/edit`);
  expect(ownEdit.status).toBe(200);
  const otherEdit = await agent.get(`/admin/media/${otherMediaId}/edit`);
  expect([302, 403, 404]).toContain(otherEdit.status);
});

test('author cannot delete another users media', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const csrf = await getCsrf(agent, '/admin');
  const response = await agent
    .delete(`/admin/media/${otherMediaId}`)
    .type('form')
    .send({ _csrf: csrf });
  expect([302, 403]).toContain(response.status);
  const media = await models.Media.findByPk(otherMediaId);
  expect(media).toBeTruthy();
});
