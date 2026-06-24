const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, sequelize, models } = require('../server');

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  const permissionSlugs = ['view_dashboard', 'create_posts', 'edit_posts', 'upload_media'];
  for (const slug of permissionSlugs) {
    await models.Permission.findOrCreate({
      where: { slug },
      defaults: { name: slug.replace(/_/g, ' ') }
    });
  }
  const [authorRole] = await models.Role.findOrCreate({
    where: { slug: 'author' },
    defaults: { name: 'Author' }
  });
  const rolePermissions = await models.Permission.findAll({ where: { slug: permissionSlugs } });
  await authorRole.setPermissions(rolePermissions);
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

  await models.User.update(
    { force_password_change: false },
    { where: { email: 'admin@example.com' } }
  );

  const [editorRole] = await models.Role.findOrCreate({
    where: { slug: 'rbac-editor' },
    defaults: { name: 'RBAC Editor' }
  });
  const editorPermissions = await models.Permission.findAll({
    where: { slug: ['view_dashboard', 'manage_categories', 'manage_posts'] }
  });
  await editorRole.setPermissions(editorPermissions);
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

afterAll(async () => {
  await sequelize.close();
});

async function login(agent, email, password) {
  const page = await agent.get('/admin/login');
  const tokenMatch = page.text.match(/name="_csrf" value="([^"]+)"/);
  return agent
    .post('/admin/login')
    .type('form')
    .send({ email, password, _csrf: tokenMatch?.[1] || '' });
}

test('author cannot access categories admin', async () => {
  const agent = request.agent(app);
  const response = await login(agent, 'author@example.com', 'Author@12345');
  expect(response.status).toBeLessThan(400);
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
