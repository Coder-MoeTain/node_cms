const request = require('supertest');
const { app, models } = require('../server');
const { renderBlocks } = require('../utils/blockRenderer');

describe('FSE public route rendering', () => {
  const blocks = [
    { type: 'heading', content: 'FSE Route Test Heading', attrs: { level: 1 } },
    { type: 'paragraph', content: 'Rendered on public blog route.' }
  ];

  beforeAll(async () => {
    const [row] = await models.SiteTemplate.findOrCreate({
      where: { slug: 'fse-blog-test', theme_slug: 'classic-blog' },
      defaults: {
        name: 'FSE Blog Test',
        template_type: 'blog',
        block_content_json: JSON.stringify(blocks),
        status: 'active'
      }
    });
    await row.update({
      block_content_json: JSON.stringify(blocks),
      status: 'active',
      template_type: 'blog'
    });
  });

  afterAll(async () => {
    await models.SiteTemplate.update({ status: 'inactive' }, { where: { slug: 'fse-blog-test' } });
  });

  test('GET /blog renders active FSE blog template when configured', async () => {
    const res = await request(app).get('/blog');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/FSE Route Test Heading/);
    expect(renderBlocks(blocks)).toMatch(/Rendered on public blog route/);
  });
});
