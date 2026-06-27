const { Op } = require('sequelize');
const { Post, Page } = require('../models');

async function findMediaUsage(filePath, options = {}) {
  if (!filePath) return { posts: [], pages: [] };
  const limit = Math.min(Number(options.limit) || 20, 50);
  const like = { [Op.like]: `%${filePath}%` };
  const attrs = ['id', 'title', 'slug', 'post_type', 'status'];

  const [posts, pages] = await Promise.all([
    Post.findAll({
      where: { [Op.or]: [{ featured_image: filePath }, { content: like }] },
      attributes: attrs,
      limit,
      order: [['updated_at', 'DESC']]
    }),
    Page.findAll({
      where: { [Op.or]: [{ featured_image: filePath }, { content: like }] },
      attributes: ['id', 'title', 'slug', 'status'],
      limit,
      order: [['updated_at', 'DESC']]
    })
  ]);

  return {
    posts: posts.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      post_type: row.post_type,
      status: row.status,
      href: row.post_type === 'post' ? `/admin/posts/${row.id}/edit` : `/admin/content/${row.post_type}/${row.id}/edit`
    })),
    pages: pages.map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      href: `/admin/pages/${row.id}/edit`
    }))
  };
}

module.exports = { findMediaUsage };
