const request = require('supertest');
const bcrypt = require('bcrypt');
const { app, models } = require('../server');
const { login, getCsrf, postForm, putForm } = require('./helpers');

let adminAgent;

beforeAll(async () => {
  await models.User.update({ force_password_change: false }, { where: { email: 'admin@example.com' } });

  for (const slug of [
    'manage_menus', 'manage_users', 'manage_posts', 'manage_pages', 'manage_settings', 'manage_banners'
  ]) {
    await models.Permission.findOrCreate({ where: { slug }, defaults: { name: slug } });
  }
  const admin = await models.User.findOne({ where: { email: 'admin@example.com' }, include: [models.Role] });
  const role = admin?.Role || await models.Role.findOne({ where: { slug: 'super-admin' } });
  const perms = await models.Permission.findAll({
    where: { slug: ['manage_menus', 'manage_users', 'manage_posts', 'manage_pages', 'manage_settings', 'manage_banners'] }
  });
  if (role) await role.addPermissions(perms);

  adminAgent = request.agent(app);
  await login(adminAgent, 'admin@example.com', 'Admin@12345');
});

describe('admin menus and menu items', () => {
  test('admin can create menu, add item, and filter menu items by menu', async () => {
    const menuSlug = `loop5-menu-${Date.now()}`;
    const createMenu = await postForm(adminAgent, '/admin/menus', {
      name: 'Loop5 Footer Menu',
      slug: menuSlug,
      location: 'footer',
      active: 'on'
    }, '/admin/menus/create');
    expect(createMenu.status).toBe(302);

    const menu = await models.Menu.findOne({ where: { slug: menuSlug } });
    expect(menu).toBeTruthy();

    const editMenu = await adminAgent.get(`/admin/menus/${menu.id}/edit`);
    expect(editMenu.status).toBe(200);
    expect(editMenu.text).toMatch(/Loop5 Footer Menu/);

    const createItem = await postForm(adminAgent, '/admin/menu-items', {
      menu_id: menu.id,
      title: 'Contact Us',
      url: '/contact',
      item_type: 'custom',
      target: '_self',
      display_order: 1,
      active: 'on'
    }, '/admin/menu-items/create');
    expect(createItem.status).toBe(302);

    const item = await models.MenuItem.findOne({ where: { menu_id: menu.id, title: 'Contact Us' } });
    expect(item).toBeTruthy();

    const filtered = await adminAgent.get(`/admin/menu-items?menu_id=${menu.id}`);
    expect(filtered.status).toBe(200);
    expect(filtered.text).toMatch(/Contact Us/);

    const updateMenu = await putForm(adminAgent, `/admin/menus/${menu.id}`, {
      name: 'Loop5 Footer Updated',
      slug: menuSlug,
      location: 'footer',
      active: 'on'
    }, `/admin/menus/${menu.id}/edit`);
    expect(updateMenu.status).toBe(302);
    await menu.reload();
    expect(menu.name).toBe('Loop5 Footer Updated');
  });
});

describe('admin users CRUD', () => {
  test('admin can create and update a user', async () => {
    const editorRole = await models.Role.findOne({ where: { slug: 'editor' } })
      || await models.Role.create({ name: 'Editor', slug: 'editor' });
    const email = `loop5-user-${Date.now()}@test.local`;

    const create = await postForm(adminAgent, '/admin/users', {
      name: 'Loop5 Test User',
      email,
      password: 'Loop5User@12345',
      role_id: editorRole.id,
      status: 'active'
    }, '/admin/users/create');
    expect(create.status).toBe(302);

    const user = await models.User.findOne({ where: { email } });
    expect(user).toBeTruthy();
    expect(user.role_id).toBe(editorRole.id);

    const edit = await adminAgent.get(`/admin/users/${user.id}/edit`);
    expect(edit.status).toBe(200);

    const update = await putForm(adminAgent, `/admin/users/${user.id}`, {
      name: 'Loop5 Updated User',
      email,
      role_id: editorRole.id,
      status: 'active'
    }, `/admin/users/${user.id}/edit`);
    expect(update.status).toBe(302);
    await user.reload();
    expect(user.name).toBe('Loop5 Updated User');
  });
});

describe('admin crud bulk category and author actions', () => {
  test('bulk change_category and change_author update posts', async () => {
    const [category] = await models.Category.findOrCreate({
      where: { slug: 'loop5-bulk-cat' },
      defaults: { name: 'Loop5 Bulk Cat', slug: 'loop5-bulk-cat' }
    });
    const author = await models.User.findOne({ where: { email: 'admin@example.com' } });
    const otherRole = await models.Role.findOne({ where: { slug: 'author' } })
      || await models.Role.create({ name: 'Author', slug: 'author' });
    const [otherUser] = await models.User.findOrCreate({
      where: { email: 'loop5-author@test.local' },
      defaults: {
        name: 'Loop5 Author',
        email: 'loop5-author@test.local',
        password: await bcrypt.hash('Author@12345', 12),
        role_id: otherRole.id,
        status: 'active'
      }
    });

    const postA = await models.Post.create({
      title: 'Loop5 Bulk Post A',
      slug: `loop5-bulk-a-${Date.now()}`,
      content: '<p>A</p>',
      status: 'draft',
      post_type: 'post',
      author_id: author.id
    });
    const postB = await models.Post.create({
      title: 'Loop5 Bulk Post B',
      slug: `loop5-bulk-b-${Date.now()}`,
      content: '<p>B</p>',
      status: 'draft',
      post_type: 'post',
      author_id: author.id
    });

    const categoryBulk = await postForm(adminAgent, '/admin/posts/bulk', {
      action: 'change_category',
      ids: [String(postA.id), String(postB.id)],
      bulk_category_id: category.id
    }, '/admin/posts');
    expect(categoryBulk.status).toBe(302);
    await postA.reload();
    await postB.reload();
    expect(postA.category_id).toBe(category.id);
    expect(postB.category_id).toBe(category.id);

    const authorBulk = await postForm(adminAgent, '/admin/posts/bulk', {
      action: 'change_author',
      ids: [String(postA.id)],
      bulk_author_id: otherUser.id
    }, '/admin/posts');
    expect(authorBulk.status).toBe(302);
    await postA.reload();
    expect(postA.author_id).toBe(otherUser.id);
  });
});

describe('admin messages and banners', () => {
  test('admin can mark contact message read and create banner', async () => {
    const message = await models.ContactMessage.create({
      name: 'Loop5 Visitor',
      email: 'visitor@test.local',
      subject: 'Loop5 inquiry',
      message: 'Hello from loop 5',
      status: 'unread'
    });

    const inbox = await adminAgent.get('/admin/messages?q=visitor@test.local');
    expect(inbox.status).toBe(200);
    expect(inbox.text).toMatch(/Loop5 Visitor|visitor@test.local/);

    const update = await putForm(adminAgent, `/admin/messages/${message.id}`, {
      status: 'read'
    }, `/admin/messages/${message.id}/edit`);
    expect(update.status).toBe(302);
    await message.reload();
    expect(message.status).toBe('read');

    const createBanner = await postForm(adminAgent, '/admin/banners', {
      title: 'Loop5 Promo Banner',
      subtitle: 'Limited time',
      button_text: 'Learn more',
      button_link: '/contact',
      display_order: 1,
      active: 'on'
    }, '/admin/banners/create');
    expect(createBanner.status).toBe(302);

    const banner = await models.Banner.findOne({ where: { title: 'Loop5 Promo Banner' } });
    expect(banner).toBeTruthy();
    expect(banner.active).toBe(true);
  });
});
