const { Comment, SiteSetting } = require('../models');

const DEFAULT_MAX_DEPTH = 5;

async function getCommentMaxDepth() {
  const row = await SiteSetting.findOne({ where: { key: 'comment_max_depth' } });
  const value = Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_DEPTH;
}

async function getCommentDepth(parentId) {
  if (!parentId) return 0;
  let depth = 0;
  let currentId = parentId;
  const seen = new Set();
  while (currentId && depth < 50) {
    if (seen.has(currentId)) break;
    seen.add(currentId);
    const row = await Comment.findByPk(currentId, { attributes: ['id', 'parent_id'] });
    if (!row) break;
    depth += 1;
    currentId = row.parent_id;
  }
  return depth;
}

async function validateCommentParent(parentId, postId) {
  if (!parentId) return { valid: true };
  const parent = await Comment.findByPk(parentId);
  if (!parent || parent.post_id !== postId) {
    return { valid: false, error: 'Parent comment not found for this post.' };
  }
  const maxDepth = await getCommentMaxDepth();
  const depth = await getCommentDepth(parentId);
  if (depth >= maxDepth) {
    return { valid: false, error: `Maximum reply depth (${maxDepth}) exceeded.` };
  }
  return { valid: true };
}

module.exports = {
  DEFAULT_MAX_DEPTH,
  getCommentMaxDepth,
  getCommentDepth,
  validateCommentParent
};
