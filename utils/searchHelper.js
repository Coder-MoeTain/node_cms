const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Post, Page } = require('../models');

function escapeSearchTerm(query) {
  return String(query || '').trim().replace(/[+\-><()~*"@]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function booleanAgainst(term) {
  return term.split(/\s+/).filter(Boolean).map((word) => `+${word}*`).join(' ');
}

function postsFulltextLiteral(against) {
  return sequelize.literal(
    `MATCH (posts.title, posts.excerpt, posts.content) AGAINST (${sequelize.escape(against)} IN BOOLEAN MODE)`
  );
}

function pagesFulltextLiteral(against) {
  return sequelize.literal(
    `MATCH (pages.title, pages.excerpt, pages.content) AGAINST (${sequelize.escape(against)} IN BOOLEAN MODE)`
  );
}

function postsLikeWhere(term) {
  return {
    [Op.or]: [
      { title: { [Op.like]: `%${term}%` } },
      { excerpt: { [Op.like]: `%${term}%` } },
      { content: { [Op.like]: `%${term}%` } }
    ]
  };
}

function pagesLikeWhere(term) {
  return {
    [Op.or]: [
      { title: { [Op.like]: `%${term}%` } },
      { excerpt: { [Op.like]: `%${term}%` } },
      { content: { [Op.like]: `%${term}%` } }
    ]
  };
}

async function searchPosts(query, options = {}) {
  const term = escapeSearchTerm(query);
  if (!term) return { rows: [], count: 0 };
  const {
    limit = 20,
    offset = 0,
    status = 'published',
    include = [],
    order = [['published_at', 'DESC']],
    distinct = false
  } = options;
  const baseWhere = { status, post_type: 'post' };
  const against = booleanAgainst(term);

  try {
    return await Post.findAndCountAll({
      where: { ...baseWhere, [Op.and]: [postsFulltextLiteral(against)] },
      include,
      distinct,
      limit,
      offset,
      order
    });
  } catch {
    return Post.findAndCountAll({
      where: { ...baseWhere, ...postsLikeWhere(term) },
      include,
      distinct,
      limit,
      offset,
      order
    });
  }
}

async function searchPostsList(query, options = {}) {
  const term = escapeSearchTerm(query);
  if (!term) return [];
  const { limit = 20, status = 'published', order = [['published_at', 'DESC']] } = options;
  const baseWhere = { status, post_type: 'post' };
  const against = booleanAgainst(term);
  try {
    return await Post.findAll({
      where: { ...baseWhere, [Op.and]: [postsFulltextLiteral(against)] },
      limit,
      order
    });
  } catch {
    return Post.findAll({
      where: { ...baseWhere, ...postsLikeWhere(term) },
      limit,
      order
    });
  }
}

async function searchPages(query, options = {}) {
  const term = escapeSearchTerm(query);
  if (!term) return [];
  const { limit = 10, status = 'published', order = [['updated_at', 'DESC']] } = options;
  const baseWhere = { status };
  const against = booleanAgainst(term);
  try {
    return await Page.findAll({
      where: { ...baseWhere, [Op.and]: [pagesFulltextLiteral(against)] },
      limit,
      order
    });
  } catch {
    return Page.findAll({
      where: { ...baseWhere, ...pagesLikeWhere(term) },
      limit,
      order
    });
  }
}

module.exports = {
  escapeSearchTerm,
  searchPosts,
  searchPostsList,
  searchPages
};
