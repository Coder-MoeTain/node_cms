const { findMediaUsage } = require('../utils/mediaUsage');
const { upsertReusableBlock, loadReusableBlocks, getReusableBlock } = require('../utils/reusableBlocks');
const models = require('../models');

describe('Loop 12 commercial gaps', () => {
  test('findMediaUsage locates posts referencing file path', async () => {
    const path = `/uploads/loop12-${Date.now()}.jpg`;
    const post = await models.Post.create({
      title: 'Media usage test',
      slug: `media-usage-${Date.now()}`,
      content: `<p><img src="${path}"></p>`,
      status: 'draft',
      post_type: 'post'
    });
    const usage = await findMediaUsage(path);
    expect(usage.posts.some((p) => p.id === post.id)).toBe(true);
    await post.destroy();
  });

  test('reusable blocks persist in site settings', async () => {
    const slug = `cta-${Date.now()}`;
    await upsertReusableBlock({
      title: slug,
      blocks: [{ type: 'paragraph', content: 'Reusable CTA' }]
    });
    const saved = await getReusableBlock(slug);
    expect(saved?.blocks?.[0]?.content).toBe('Reusable CTA');
    const all = await loadReusableBlocks();
    expect(all.some((b) => b.slug === slug)).toBe(true);
  });
});
