const { exportPayloadToWxr, mapStatusToWp } = require('../utils/wxrExporter');
const { parseWxr, isWxrDocument } = require('../utils/wxrImporter');

describe('WordPress WXR export', () => {
  test('mapStatusToWp converts NodePress statuses', () => {
    expect(mapStatusToWp('published')).toBe('publish');
    expect(mapStatusToWp('draft')).toBe('draft');
    expect(mapStatusToWp('pending')).toBe('pending');
  });

  test('exportPayloadToWxr produces WordPress-compatible XML', () => {
    const xml = exportPayloadToWxr({
      version: '1.1',
      posts: [{
        title: 'Export Post',
        slug: 'export-post',
        content: '<p>Body</p>',
        excerpt: 'Excerpt',
        status: 'published'
      }],
      pages: [{
        title: 'About',
        slug: 'about',
        content: '<p>Page</p>',
        status: 'published'
      }],
      categories: [{ name: 'News', slug: 'news' }],
      tags: [{ name: 'Launch', slug: 'launch' }],
      media: [{
        filename: 'hero.jpg',
        original_name: 'hero.jpg',
        file_path: '/uploads/hero.jpg',
        mime_type: 'image/jpeg'
      }]
    }, { siteTitle: 'Test Site', siteUrl: 'https://example.com' });

    expect(isWxrDocument(xml)).toBe(true);
    expect(xml).toMatch(/Export Post/);
    expect(xml).toMatch(/wp:post_type>post/);
    expect(xml).toMatch(/wp:post_type>page/);
    expect(xml).toMatch(/wp:post_type>attachment/);
    expect(xml).toMatch(/domain="category"/);
    expect(xml).toMatch(/domain="post_tag"/);
  });

  test('exported WXR can be parsed back into import payload', () => {
    const xml = exportPayloadToWxr({
      posts: [{ title: 'Round Trip', slug: 'round-trip', content: '<p>x</p>', status: 'published' }],
      pages: [],
      categories: [],
      tags: []
    });
    const payload = parseWxr(xml);
    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0].slug).toBe('round-trip');
    expect(payload.posts[0].status).toBe('published');
  });
});
