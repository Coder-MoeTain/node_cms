const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');

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

  const adminPermissionSlugs = [
    'view_dashboard', 'manage_posts', 'manage_pages', 'manage_media', 'manage_comments',
    'manage_users', 'manage_settings', 'manage_plugins', 'manage_themes', 'manage_security'
  ];
  for (const slug of adminPermissionSlugs) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const [adminRole] = await models.Role.findOrCreate({ where: { slug: 'rbac-admin' }, defaults: { name: 'RBAC Admin' } });
  const adminPerms = await models.Permission.findAll({ where: { slug: adminPermissionSlugs } });
  await adminRole.setPermissions(adminPerms);
  await models.User.findOrCreate({
    where: { email: 'rbac-admin@test.local' },
    defaults: {
      name: 'RBAC Admin',
      email: 'rbac-admin@test.local',
      password: await bcrypt.hash('RbacAdmin@12345', 12),
      role_id: adminRole.id,
      status: 'active',
      force_password_change: false
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

test('editor cannot access plugins admin', async () => {
  const agent = request.agent(app);
  await login(agent, 'editor@test.local', 'Editor@12345');
  const plugins = await agent.get('/admin/plugins');
  expect([302, 403]).toContain(plugins.status);
});

test('editor cannot access themes admin', async () => {
  const agent = request.agent(app);
  await login(agent, 'editor@test.local', 'Editor@12345');
  const themes = await agent.get('/admin/themes');
  expect([302, 403]).toContain(themes.status);
});

test('admin without manage_roles cannot access roles admin', async () => {
  const agent = request.agent(app);
  await login(agent, 'rbac-admin@test.local', 'RbacAdmin@12345');
  const roles = await agent.get('/admin/roles');
  expect([302, 403]).toContain(roles.status);
});

test('subscriber login redirects to public site', async () => {
  const [subscriberRole] = await models.Role.findOrCreate({
    where: { slug: 'subscriber' },
    defaults: { name: 'Subscriber' }
  });
  await subscriberRole.setPermissions([]);
  await models.User.findOrCreate({
    where: { email: 'subscriber@test.local' },
    defaults: {
      name: 'Subscriber User',
      email: 'subscriber@test.local',
      password: await bcrypt.hash('Subscriber@12345', 12),
      role_id: subscriberRole.id,
      status: 'active',
      force_password_change: false
    }
  });
  const agent = request.agent(app);
  const csrf = await getCsrf(agent, '/admin/login');
  const response = await agent
    .post('/admin/login')
    .type('form')
    .send({ email: 'subscriber@test.local', password: 'Subscriber@12345', _csrf: csrf });
  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/');
});

test('subscriber cannot access admin dashboard', async () => {
  const agent = request.agent(app);
  await login(agent, 'subscriber@test.local', 'Subscriber@12345');
  const dashboard = await agent.get('/admin');
  expect([302, 403]).toContain(dashboard.status);
});
