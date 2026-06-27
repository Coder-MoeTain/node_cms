const { exportPayloadToWxr } = require('../utils/wxrExporter');
const { parseWxr, isWxrDocument } = require('../utils/wxrImporter');

describe('WXR extended export', () => {
  test('exports menus, CPT, and field groups via np:extensions', () => {
    const xml = exportPayloadToWxr({
      posts: [{ title: 'News', slug: 'news', content: '<p>x</p>', status: 'published' }],
      pages: [],
      categories: [],
      tags: [],
      menus: [{
        name: 'Main',
        slug: 'main',
        items: [{ title: 'Home', url: '/', item_type: 'custom', display_order: 0 }]
      }],
      custom_post_types: [{ name: 'Events', slug: 'events', status: 'active' }],
      field_groups: [{ name: 'Event Meta', slug: 'event-meta', fields: [{ name: 'venue', label: 'Venue', type: 'text' }] }]
    });

    expect(isWxrDocument(xml)).toBe(true);
    expect(xml).toMatch(/nav_menu/);
    expect(xml).toMatch(/np:extensions/);
    expect(xml).toMatch(/events/);
  });

  test('parseWxr restores extensions and menus', () => {
    const xml = exportPayloadToWxr({
      posts: [],
      pages: [],
      menus: [{
        name: 'Footer',
        slug: 'footer',
        items: [{ title: 'Contact', url: '/contact', item_type: 'custom' }]
      }],
      custom_post_types: [{ name: 'Jobs', slug: 'jobs', status: 'active' }],
      field_groups: [{ name: 'Job Meta', slug: 'job-meta', fields: [] }]
    });
    const payload = parseWxr(xml);
    expect(payload.menus).toHaveLength(1);
    expect(payload.menus[0].slug).toBe('footer');
    expect(payload.custom_post_types).toHaveLength(1);
    expect(payload.field_groups).toHaveLength(1);
  });
});
