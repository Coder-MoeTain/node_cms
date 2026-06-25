const crypto = require('crypto');

function buildCommentTree(comments = []) {
  const nodes = comments.map((c) => ({
    ...(typeof c.get === 'function' ? c.get({ plain: true }) : c),
    replies: []
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots = [];
  for (const node of nodes) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id).replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function gravatarUrl(email, size = 48) {
  const hash = crypto.createHash('md5').update(String(email || '').trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
}

function countComments(tree = []) {
  return tree.reduce((sum, node) => sum + 1 + countComments(node.replies || []), 0);
}

module.exports = { buildCommentTree, gravatarUrl, countComments };
