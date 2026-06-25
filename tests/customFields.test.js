const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf, postForm } = require('./helpers');
const {
  sanitizeFieldValue,
  validateFieldValue,
  saveCustomFieldValues,
  loadCustomFieldsMap
} = require('../utils/customFields');

describe('Custom field utilities', () => {
  test('sanitizeFieldValue strips scripts from rich text', () => {
    const field = { type: 'rich_text' };
    const value = sanitizeFieldValue(field, '<p>Hi</p><script>x</script>');
    expect(value).toMatch(/Hi/);
    expect(value).not.toMatch(/<script>/);
  });

  test('validateFieldValue rejects missing required fields', () => {
    const field = { label: 'Email', type: 'email', is_required: true };
    expect(validateFieldValue(field, '')).toMatch(/required/i);
    expect(validateFieldValue(field, 'bad')).toMatch(/valid email/i);
    expect(validateFieldValue(field, 'user@example.com')).toBeNull();
  });

  test('validateFieldValue rejects invalid URLs', () => {
    const field = { label: 'Website', type: 'url', is_required: false };
    expect(validateFieldValue(field, 'ftp://x.com')).toMatch(/valid URL/i);
    expect(validateFieldValue(field, 'https://example.com')).toBeNull();
  });
});

describe('Custom field groups (admin → DB → public)', () => {
  let typeSlug;

  beforeAll(async () => {
    await models.Permission.findOrCreate({
      where: { slug: 'manage_custom_fields' },
      defaults: { name: 'Manage Custom Fields' }
    });
    await models.Permission.findOrCreate({
      where: { slug: 'manage_custom_content' },
      defaults: { name: 'Manage Custom Content' }
    });
    const admin = await models.User.findOne({ where: { email: 'admin@example.com' }, include: [models.Role] });
    const role = admin?.Role || await models.Role.findOne({ where: { slug: 'super-admin' } });
    const perms = await models.Permission.findAll({
      where: { slug: ['manage_custom_fields', 'manage_custom_content', 'manage_custom_post_types'] }
    });
    if (role) await role.addPermissions(perms);
  });

  beforeEach(async () => {
    typeSlug = `events-${Date.now()}`;
    await models.CustomPostType.create({
      name: 'Events',
      slug: typeSlug,
      status: 'active',
      supports_title: true,
      supports_editor: true,
      supports_custom_fields: true,
      has_archive: true
    });
  });

  test('admin field group CRUD and attachment to CPT', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');

    const list = await agent.get('/admin/field-groups');
    expect(list.status).toBe(200);

    const csrf = await getCsrf(agent, '/admin/field-groups/create');
    const groupSlug = `event-meta-${Date.now()}`;
    const create = await agent.post('/admin/field-groups').type('form').send({
      name: 'Event Meta',
      slug: groupSlug,
      location_type: 'custom_post_type',
      location_value: typeSlug,
      status: 'active',
      _csrf: csrf
    });
    expect(create.status).toBe(302);

    const group = await models.FieldGroup.findOne({ where: { slug: groupSlug } });
    expect(group).toBeTruthy();
    expect(group.location_value).toBe(typeSlug);
  });

  test('required custom field blocks save when empty', async () => {
    const group = await models.FieldGroup.create({
      name: 'Event Details',
      slug: `event-details-${Date.now()}`,
      location_type: 'custom_post_type',
      location_value: typeSlug,
      status: 'active'
    });
    await models.CustomField.create({
      field_group_id: group.id,
      label: 'Event Date',
      name: 'event_date',
      type: 'date',
      is_required: true,
      status: 'active'
    });

    const post = await models.Post.create({
      title: 'Draft Event',
      slug: `draft-event-${Date.now()}`,
      post_type: typeSlug,
      content: '<p>x</p>',
      status: 'draft'
    });

    await expect(
      saveCustomFieldValues('custom_post', post.id, {}, 'custom_post_type', typeSlug)
    ).rejects.toMatchObject({ status: 400 });
  });

  test('custom field values save and render on public single', async () => {
    const group = await models.FieldGroup.create({
      name: 'Venue',
      slug: `venue-${Date.now()}`,
      location_type: 'custom_post_type',
      location_value: typeSlug,
      status: 'active'
    });
    await models.CustomField.create({
      field_group_id: group.id,
      label: 'Venue Name',
      name: 'venue_name',
      type: 'text',
      is_required: true,
      status: 'active'
    });

    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const itemSlug = `town-hall-${Date.now()}`;
    const save = await postForm(
      agent,
      `/admin/content/${typeSlug}`,
      {
        title: 'Town Hall',
        slug: itemSlug,
        content: '<p>Public meeting</p>',
        status: 'published',
        cf_venue_name: 'City Hall Auditorium'
      },
      `/admin/content/${typeSlug}/create`
    );
    expect(save.status).toBe(302);

    const post = await models.Post.findOne({ where: { slug: itemSlug, post_type: typeSlug } });
    const map = await loadCustomFieldsMap('custom_post', post.id, 'custom_post_type', typeSlug);
    expect(map.venue_name).toBe('City Hall Auditorium');

    const publicPage = await request(app).get(`/types/${typeSlug}/${itemSlug}`);
    expect(publicPage.status).toBe(200);
    expect(publicPage.text).toMatch(/City Hall Auditorium/);
    expect(publicPage.text).toMatch(/Town Hall/);
  });
});
