const express = require('express');
const { Op } = require('sequelize');
const {
  Post, Page, Category, Tag, CustomPostType, Media, User, Comment, Menu, WidgetArea
} = require('../../../models');
const { getPagination, pageMeta } = require('../../../utils/pagination');
const { loadCustomFieldsMap } = require('../../../utils/customFields');
const policy = require('../../../utils/policy');

const router = express.Router();

function apiError(res, status, message, details = null) {
  const body = { error: { code: status, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

function requireWrite(req, res, next) {
  if (!req.apiUser && !req.session?.user) {
    return apiError(res, 401, 'Authentication required for write operations.');
  }
  if (req.apiUser || policy.isSuperAdmin(req.session?.user) || policy.hasPermission(req.session?.user, 'manage_posts')) {
    return next();
  }
  return apiError(res, 403, 'Insufficient permissions.');
}

router.get('/posts', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, 20);
    const where = { status: 'published', post_type: 'post' };
    if (req.query.search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${req.query.search}%` } },
        { content: { [Op.like]: `%${req.query.search}%` } }
      ];
    }
    const { rows, count } = await Post.findAndCountAll({
      where,
      include: [Category, Tag],
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    res.json({ data: rows, meta: pageMeta(count, page, limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/posts/:idOrSlug', async (req, res, next) => {
  try {
    const where = { status: 'published', post_type: 'post' };
    where[Number.isFinite(Number(req.params.idOrSlug)) ? 'id' : 'slug'] = req.params.idOrSlug;
    const post = await Post.findOne({ where, include: [Category, Tag] });
    if (!post) return apiError(res, 404, 'Post not found.');
    return res.json({ data: post });
  } catch (error) {
    return next(error);
  }
});

router.get('/pages/:idOrSlug', async (req, res, next) => {
  try {
    const where = { status: 'published' };
    where[Number.isFinite(Number(req.params.idOrSlug)) ? 'id' : 'slug'] = req.params.idOrSlug;
    const page = await Page.findOne({ where });
    if (!page) return apiError(res, 404, 'Page not found.');
    return res.json({ data: page });
  } catch (error) {
    return next(error);
  }
});

router.get('/types', async (req, res, next) => {
  try {
    const types = await CustomPostType.findAll({
      where: { status: 'active', show_in_api: true },
      order: [['name', 'ASC']]
    });
    res.json({ data: types });
  } catch (error) {
    next(error);
  }
});

router.get('/types/:slug', async (req, res, next) => {
  try {
    const type = await CustomPostType.findOne({
      where: { slug: req.params.slug, status: 'active', show_in_api: true }
    });
    if (!type) return apiError(res, 404, 'Post type not found.');
    return res.json({ data: type });
  } catch (error) {
    return next(error);
  }
});

router.get('/types/:slug/content', async (req, res, next) => {
  try {
    const type = await CustomPostType.findOne({
      where: { slug: req.params.slug, status: 'active', show_in_api: true }
    });
    if (!type) return apiError(res, 404, 'Post type not found.');
    const { page, limit, offset } = getPagination(req, 20);
    const { rows, count } = await Post.findAndCountAll({
      where: { post_type: type.slug, status: 'published' },
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    res.json({ data: rows, meta: pageMeta(count, page, limit), type: { slug: type.slug, name: type.name } });
  } catch (error) {
    next(error);
  }
});

router.get('/types/:slug/content/:idOrSlug', async (req, res, next) => {
  try {
    const type = await CustomPostType.findOne({
      where: { slug: req.params.slug, status: 'active', show_in_api: true }
    });
    if (!type) return apiError(res, 404, 'Post type not found.');
    const where = { post_type: type.slug, status: 'published' };
    where[Number.isFinite(Number(req.params.idOrSlug)) ? 'id' : 'slug'] = req.params.idOrSlug;
    const item = await Post.findOne({ where });
    if (!item) return apiError(res, 404, 'Content not found.');
    let customFields = {};
    if (type.supports_custom_fields) {
      customFields = await loadCustomFieldsMap('custom_post', item.id, 'custom_post_type', type.slug);
    }
    return res.json({ data: item, custom_fields: customFields });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    res.json({ data: await Category.findAll({ order: [['name', 'ASC']] }) });
  } catch (error) {
    next(error);
  }
});

router.get('/tags', async (req, res, next) => {
  try {
    res.json({ data: await Tag.findAll({ order: [['name', 'ASC']] }) });
  } catch (error) {
    next(error);
  }
});

router.get('/media', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, 20);
    const { rows, count } = await Media.findAndCountAll({ limit, offset, order: [['created_at', 'DESC']] });
    res.json({ data: rows, meta: pageMeta(count, page, limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const { SiteSetting } = require('../../../models');
    const rows = await SiteSetting.findAll({ where: { key: { [Op.like]: 'public_%' } } });
    const data = rows.reduce((map, row) => ({ ...map, [row.key]: row.value }), {});
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/posts', requireWrite, async (req, res, next) => {
  try {
    const post = await Post.create({
      title: req.body.title || 'Untitled',
      slug: req.body.slug || `post-${Date.now()}`,
      content: req.body.content || '<p></p>',
      post_type: 'post',
      status: req.body.status || 'draft',
      author_id: req.body.author_id || null,
      published_at: req.body.status === 'published' ? new Date() : null
    });
    return res.status(201).json({ data: post });
  } catch (error) {
    return next(error);
  }
});

router.put('/posts/:idOrSlug', requireWrite, async (req, res, next) => {
  try {
    const where = {};
    where[Number.isFinite(Number(req.params.idOrSlug)) ? 'id' : 'slug'] = req.params.idOrSlug;
    where.post_type = 'post';
    const post = await Post.findOne({ where });
    if (!post) return apiError(res, 404, 'Post not found.');
    await post.update({
      title: req.body.title ?? post.title,
      content: req.body.content ?? post.content,
      status: req.body.status ?? post.status
    });
    return res.json({ data: post });
  } catch (error) {
    return next(error);
  }
});

router.delete('/posts/:idOrSlug', requireWrite, async (req, res, next) => {
  try {
    const where = { post_type: 'post' };
    where[Number.isFinite(Number(req.params.idOrSlug)) ? 'id' : 'slug'] = req.params.idOrSlug;
    const post = await Post.findOne({ where });
    if (!post) return apiError(res, 404, 'Post not found.');
    await post.destroy();
    return res.json({ data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
});

router.get('/widgets', async (req, res, next) => {
  try {
    const areas = await WidgetArea.findAll({ order: [['display_order', 'ASC']] });
    res.json({ data: areas });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
