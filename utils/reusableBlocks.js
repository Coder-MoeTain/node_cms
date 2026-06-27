const models = require('../models');

const SETTING_KEY = 'reusable_blocks_json';

async function loadReusableBlocks() {
  const row = await models.SiteSetting.findOne({ where: { key: SETTING_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveReusableBlocks(blocks) {
  const payload = JSON.stringify(Array.isArray(blocks) ? blocks : []);
  const [row] = await models.SiteSetting.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: { value: payload, group: 'blocks' }
  });
  if (row.value !== payload) await row.update({ value: payload });
  return loadReusableBlocks();
}

async function upsertReusableBlock(block) {
  const blocks = await loadReusableBlocks();
  const slug = block.slug || block.title?.toLowerCase().replace(/\s+/g, '-');
  if (!slug) throw new Error('Reusable block requires a slug or title.');
  const index = blocks.findIndex((b) => b.slug === slug);
  const record = { slug, title: block.title || slug, blocks: block.blocks || [] };
  if (index >= 0) blocks[index] = record;
  else blocks.push(record);
  await saveReusableBlocks(blocks);
  return record;
}

async function getReusableBlock(slug) {
  return (await loadReusableBlocks()).find((b) => b.slug === slug) || null;
}

module.exports = {
  SETTING_KEY,
  loadReusableBlocks,
  saveReusableBlocks,
  upsertReusableBlock,
  getReusableBlock
};
