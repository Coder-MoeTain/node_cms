const { exportPostsToCsv, exportPagesToCsv } = require('../utils/csvExporter');
const { parseCsv, csvToImportPayload, isPostsCsv } = require('../utils/csvImporter');
const { listBlockPatterns, getBlockPattern } = require('../utils/blockPatterns');
const { resolvePublicContent } = require('../utils/publicContentRenderer');
const { renderBlocks } = require('../utils/blockRenderer');

describe('CSV import/export', () => {
  test('exportPostsToCsv produces header row', () => {
    const csv = exportPostsToCsv([{ id: 1, title: 'Hello', slug: 'hello', status: 'published', post_type: 'post' }]);
    expect(csv).toMatch(/title,slug,status/);
    expect(csv).toMatch(/Hello/);
  });

  test('csvToImportPayload parses posts CSV', () => {
    const raw = 'title,slug,status\nNews,news,published\n';
    expect(isPostsCsv(raw)).toBe(true);
    const payload = csvToImportPayload(raw);
    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0].slug).toBe('news');
  });
});

describe('block patterns', () => {
  test('lists and returns patterns', () => {
    const patterns = listBlockPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    const hero = getBlockPattern('hero-intro');
    expect(hero?.blocks?.length).toBeGreaterThan(0);
  });
});

describe('publicContentRenderer', () => {
  test('resolvePublicContent renders block JSON and shortcodes', () => {
    const html = resolvePublicContent({
      content_format: 'block',
      block_content_json: JSON.stringify([{ type: 'latest-posts', attrs: { limit: 2 } }])
    }, {
      recentPosts: [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }]
    });
    expect(html).toContain('>A</a>');
    expect(html).toContain('/post/a');
  });

  test('renderBlocks supports new block types', () => {
    const html = renderBlocks([{ type: 'shortcode', content: '[button url="/x" label="Go"]' }]);
    expect(html).toContain('btn');
  });
});
