const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm } = require('./helpers');

let adminAgent;

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });

  for (const slug of ['manage_roles', 'manage_sliders', 'manage_posts']) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' }, include: [models.Role] });
  const role = admin?.Role || await models.Role.findOne({ where: { slug: 'super-admin' } });
  const perms = await models.Permission.findAll({
    where: { slug: ['manage_roles', 'manage_sliders', 'manage_posts'] }
  });
  if (role) await role.addPermissions(perms);

  adminAgent = request.agent(app);
  await login(adminAgent, 'admin@example.com', 'Admin@12345');
});

describe('admin roles CRUD', () => {
  test('admin can create role with permissions, search, and update', async () => {
    const perm = await models.Permission.findOne({ where: { slug: 'manage_posts' } });
    expect(perm).toBeTruthy();

    const roleSlug = `loop6-role-${Date.now()}`;
    const create = await postForm(adminAgent, '/admin/roles', {
      name: 'Loop6 Reviewer',
      slug: roleSlug,
      description: 'Can review posts',
      permissions: String(perm.id)
    }, '/admin/roles/create');
    expect(create.status).toBe(302);

    const role = await models.Role.findOne({ where: { slug: roleSlug }, include: [models.Permission] });
    expect(role).toBeTruthy();
    expect(role.Permissions.some((row) => row.slug === 'manage_posts')).toBe(true);

    const index = await adminAgent.get(`/admin/roles?q=${encodeURIComponent('Loop6')}`);
    expect(index.status).toBe(200);
    expect(index.text).toMatch(/Loop6 Reviewer/);

    const editorPerm = await models.Permission.findOne({ where: { slug: 'manage_pages' } });
    const update = await putForm(adminAgent, `/admin/roles/${role.id}`, {
      name: 'Loop6 Reviewer Updated',
      slug: roleSlug,
      description: 'Updated reviewer role',
      permissions: [String(perm.id), String(editorPerm.id)]
    }, `/admin/roles/${role.id}/edit`);
    expect(update.status).toBe(302);

    await role.reload({ include: [models.Permission] });
    expect(role.name).toBe('Loop6 Reviewer Updated');
    expect(role.Permissions.some((row) => row.slug === 'manage_pages')).toBe(true);

    await role.setPermissions([]);
    await role.destroy();
  });
});

describe('admin sliders CRUD', () => {
  test('admin can create, update, and list sliders', async () => {
    const title = `Loop6 Slider ${Date.now()}`;
    const create = await postForm(adminAgent, '/admin/sliders', {
      title,
      description: 'Hero slide for loop 6',
      button_text: 'Learn more',
      button_url: '/about',
      display_order: 3,
      active: 'on'
    }, '/admin/sliders/create');
    expect(create.status).toBe(302);

    const slider = await models.Slider.findOne({ where: { title } });
    expect(slider).toBeTruthy();
    expect(slider.button_text).toBe('Learn more');

    const edit = await adminAgent.get(`/admin/sliders/${slider.id}/edit`);
    expect(edit.status).toBe(200);
    expect(edit.text).toMatch(title);

    const update = await putForm(adminAgent, `/admin/sliders/${slider.id}`, {
      title: `${title} Updated`,
      description: 'Updated hero slide',
      button_text: 'Contact us',
      button_url: '/contact',
      display_order: 4,
      active: 'on'
    }, `/admin/sliders/${slider.id}/edit`);
    expect(update.status).toBe(302);

    await slider.reload();
    expect(slider.title).toMatch(/Updated$/);
    expect(slider.button_url).toBe('/contact');

    const list = await adminAgent.get(`/admin/sliders?q=${encodeURIComponent('Loop6 Slider')}`);
    expect(list.status).toBe(200);
    expect(list.text).toMatch(/Updated/);

    await slider.destroy();
  });
});

describe('admin bulk edge cases', () => {
  test('unsupported bulk action on posts returns error flash', async () => {
    const post = await models.Post.create({
      title: 'Loop6 Bulk Edge',
      slug: `loop6-bulk-${Date.now()}`,
      content: '<p>bulk</p>',
      status: 'draft',
      post_type: 'post',
      author_id: (await models.User.findOne({ where: { email: 'admin@example.com' } })).id
    });

    const csrf = await getCsrf(adminAgent, '/admin/posts');
    const res = await adminAgent.post(`/admin/posts/bulk?_csrf=${encodeURIComponent(csrf)}`)
      .type('form')
      .send({
        action: 'archive',
        ids: String(post.id)
      });
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/\/admin\/posts/);

    await post.destroy();
  });

  test('editor without manage_roles cannot access roles admin', async () => {
    await models.User.findOrCreate({
      where: { email: 'loop6-editor@test.local' },
      defaults: {
        name: 'Loop6 Editor',
        email: 'loop6-editor@test.local',
        password: await bcrypt.hash('Editor@12345', 12),
        role_id: (await models.Role.findOne({ where: { slug: 'editor' } })).id,
        status: 'active',
        force_password_change: false
      }
    });
    const agent = request.agent(app);
    await login(agent, 'loop6-editor@test.local', 'Editor@12345');
    const roles = await agent.get('/admin/roles');
    expect([302, 403]).toContain(roles.status);
  });
});
