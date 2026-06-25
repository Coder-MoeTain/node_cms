const request = require('supertest');
const { app, models } = require('../server');
const { login, getCsrf } = require('./helpers');
const { validateBlockSchema, renderBlocks } = require('../utils/blockRenderer');

describe('Site templates / FSE foundation', () => {
  test('block schema validation accepts homepage template blocks', () => {
    const blocks = [
      { type: 'heading', content: 'Welcome', attrs: { level: 1 } },
      { type: 'paragraph', content: 'Official portal content.' }
    ];
    const result = validateBlockSchema(blocks);
    expect(result.valid).toBe(true);
    const html = renderBlocks(result.blocks);
    expect(html).toMatch(/Welcome/);
    expect(html).toMatch(/Official portal/);
  });

  test('admin can seed default templates and edit block JSON', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');

    const index = await agent.get('/admin/templates');
    expect(index.status).toBe(200);

    const csrfDefaults = await getCsrf(agent, '/admin/templates');
    const seed = await agent.post('/admin/templates/defaults').type('form').send({ _csrf: csrfDefaults });
    expect(seed.status).toBe(302);

    const homepage = await models.SiteTemplate.findOne({ where: { slug: 'homepage', theme_slug: 'default' } });
    expect(homepage).toBeTruthy();
    expect(homepage.status).toBe('active');

    const editPage = await agent.get(`/admin/templates/${homepage.id}/edit`);
    expect(editPage.status).toBe(200);
    expect(editPage.text).toMatch(/homepage/i);

    const blocks = [
      { type: 'heading', content: 'FSE Test Heading', attrs: { level: 2 } },
      { type: 'paragraph', content: 'Rendered on save for template preview.' }
    ];
    const csrfUpdate = await getCsrf(agent, `/admin/templates/${homepage.id}/edit`);
    const update = await agent.put(`/admin/templates/${homepage.id}`).type('form').send({
      name: 'Homepage (test)',
      status: 'active',
      block_content_json: JSON.stringify(blocks),
      _csrf: csrfUpdate
    });
    expect(update.status).toBe(302);

    await homepage.reload();
    const parsed = JSON.parse(homepage.block_content_json);
    expect(parsed[0].content).toBe('FSE Test Heading');
    const rendered = renderBlocks(parsed);
    expect(rendered).toMatch(/FSE Test Heading/);
    expect(rendered).not.toMatch(/<script>/);
  });

  test('invalid template block JSON is rejected', async () => {
    const agent = request.agent(app);
    await login(agent, 'admin@example.com', 'Admin@12345');
    const template = await models.SiteTemplate.findOne({ order: [['id', 'ASC']] });
    if (!template) return;

    const csrf = await getCsrf(agent, `/admin/templates/${template.id}/edit`);
    const bad = await agent.put(`/admin/templates/${template.id}`).type('form').send({
      name: template.name,
      status: 'active',
      block_content_json: 'not-json',
      _csrf: csrf
    });
    expect(bad.status).toBe(302);
    await template.reload();
    expect(template.block_content_json).not.toBe('not-json');
  });
});
