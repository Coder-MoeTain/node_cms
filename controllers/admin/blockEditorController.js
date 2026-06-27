const { listBlockPatterns, getBlockPattern } = require('../../utils/blockPatterns');
const { upsertReusableBlock, loadReusableBlocks, getReusableBlock } = require('../../utils/reusableBlocks');

async function listPatterns(req, res, next) {
  try {
    return res.json({ data: listBlockPatterns() });
  } catch (error) {
    return next(error);
  }
}

async function getPattern(req, res, next) {
  try {
    const pattern = getBlockPattern(req.params.slug);
    if (!pattern) return res.status(404).json({ error: 'Pattern not found' });
    return res.json({ data: pattern });
  } catch (error) {
    return next(error);
  }
}

async function listReusable(req, res, next) {
  try {
    return res.json({ data: await loadReusableBlocks() });
  } catch (error) {
    return next(error);
  }
}

async function saveReusable(req, res, next) {
  try {
    const title = String(req.body.title || '').trim();
    let blocks = req.body.blocks;
    if (typeof blocks === 'string') {
      try { blocks = JSON.parse(blocks); } catch { blocks = []; }
    }
    if (!title || !Array.isArray(blocks) || !blocks.length) {
      return res.status(400).json({ error: 'title and blocks array are required' });
    }
    const record = await upsertReusableBlock({ title, blocks });
    return res.status(201).json({ data: record });
  } catch (error) {
    return next(error);
  }
}

async function getReusable(req, res, next) {
  try {
    const block = await getReusableBlock(req.params.slug);
    if (!block) return res.status(404).json({ error: 'Reusable block not found' });
    return res.json({ data: block });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listPatterns, getPattern, listReusable, saveReusable, getReusable };
