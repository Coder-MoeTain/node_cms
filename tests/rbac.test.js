const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login } = require('./helpers');

beforeAll(async () => {
  const permissionSlugs = ['view_dashboard', 'create_posts', 'edit_posts', 'upload_media'];
  for (const slug of permissionSlugs) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const [authorRole] = await models.Role.findOrCreate({ where: { slug: 'author' }, defaults: { name: 'Author' } });
  const perms = await models.Permission.findAll({ where: { slug: permissionSlugs } });
  await authorRole.setPermissions(perms);
  await models.User.findOrCreate({
    where: { email: 'author@example.com' },
    defaults: {
      name: 'Author User',
      email: 'author@example.com',
      password: await bcrypt.hash('Author@12345', 12),
      role_id: authorRole.id,
      status: 'active'
    }
  });
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });

  const [editorRole] = await models.Role.findOrCreate({ where: { slug: 'rbac-editor' }, defaults: { name: 'RBAC Editor' } });
  const editorPerms = await models.Permission.findAll({
    where: { slug: ['view_dashboard', 'manage_categories', 'manage_posts'] }
  });
  await editorRole.setPermissions(editorPerms);
  await models.User.findOrCreate({
    where: { email: 'editor@test.local' },
    defaults: {
      name: 'RBAC Editor',
      email: 'editor@test.local',
      password: await bcrypt.hash('Editor@12345', 12),
      role_id: editorRole.id,
      status: 'active'
    }
  });
});

test('author cannot access categories admin', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const categories = await agent.get('/admin/categories');
  expect([302, 403]).toContain(categories.status);
});

test('author can access posts list', async () => {
  const agent = request.agent(app);
  await login(agent, 'author@example.com', 'Author@12345');
  const posts = await agent.get('/admin/posts');
  expect(posts.status).toBe(200);
});

test('editor can access categories', async () => {
  const agent = request.agent(app);
  await login(agent, 'editor@test.local', 'Editor@12345');
  const categories = await agent.get('/admin/categories');
  expect(categories.status).toBe(200);
});
