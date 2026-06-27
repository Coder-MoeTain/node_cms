const { attachFseLocals, loadFseTemplateHtml, TYPE_MAP } = require('../utils/fsePublicHelper');
const { app, models } = require('../server');
const { renderBlocks } = require('../utils/blockRenderer');

describe('fsePublicHelper', () => {
  test('maps template names to FSE types', () => {
    expect(TYPE_MAP.home).toBe('homepage');
    expect(TYPE_MAP.post).toBe('single-post');
  });

  test('returns null when no active template exists', async () => {
    const result = await loadFseTemplateHtml('search', 'nonexistent-theme-slug-xyz');
    expect(result).toBeNull();
  });

  test('loads and renders active homepage template from database', async () => {
    const blocks = [
      { type: 'heading', content: 'FSE Public Helper Test', attrs: { level: 1 } },
      { type: 'paragraph', content: 'Rendered for public FSE wiring.' }
    ];
    const [row] = await models.SiteTemplate.findOrCreate({
      where: { slug: 'fse-helper-test-home', theme_slug: 'classic-blog' },
      defaults: {
        name: 'FSE Helper Test Home',
        template_type: 'homepage',
        block_content_json: JSON.stringify(blocks),
        status: 'active'
      }
    });
    await row.update({
      block_content_json: JSON.stringify(blocks),
      status: 'active',
      template_type: 'homepage'
    });

    const result = await loadFseTemplateHtml('home', 'classic-blog');
    expect(result).not.toBeNull();
    expect(result.html).toMatch(/FSE Public Helper Test/);
    expect(renderBlocks(blocks)).toMatch(/Rendered for public FSE wiring/);
  });

  test('attachFseLocals merges fseTemplateHtml into view locals', async () => {
    const blocks = [{ type: 'paragraph', content: 'Attach locals test body.' }];
    const [row] = await models.SiteTemplate.findOrCreate({
      where: { slug: 'fse-helper-test-page', theme_slug: 'classic-blog' },
      defaults: {
        name: 'FSE Helper Test Page',
        template_type: 'page',
        block_content_json: JSON.stringify(blocks),
        status: 'active'
      }
    });
    await row.update({
      block_content_json: JSON.stringify(blocks),
      status: 'active',
      template_type: 'page'
    });

    const locals = await attachFseLocals('page', { title: 'Test Page' }, 'classic-blog');
    expect(locals.title).toBe('Test Page');
    expect(locals.fseTemplateHtml).toMatch(/Attach locals test body/);
    expect(locals.fseTemplate.slug).toBe('fse-helper-test-page');
  });

  afterAll(async () => {
    await models.SiteTemplate.update(
      { status: 'inactive' },
      { where: { slug: ['fse-helper-test-home', 'fse-helper-test-page'] } }
    );
  });
});
