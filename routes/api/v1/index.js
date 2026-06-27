const express = require('express');
const { Op } = require('sequelize');
const {
  Post, Page, Category, Tag, CustomPostType, Media, Comment, Menu, MenuItem, WidgetArea, WidgetInstance, Taxonomy, TaxonomyTerm, User
} = require('../../../models');
const { getPagination, pageMeta } = require('../../../utils/pagination');
const { loadCustomFieldsMap } = require('../../../utils/customFields');
const { searchPosts } = require('../../../utils/searchHelper');
const handlers = require('../../../utils/apiV1Handlers');
const { buildEmbedded, attachEmbed } = require('../../../utils/apiEmbed');
const upload = require('../../../middleware/upload');
const { siteScopeWhere, assignSiteScope } = require('../../../utils/siteScope');

const router = express.Router();

function requireWrite(req, res, next) {
  const denied = handlers.requireAuthWrite(req, res, ['manage_posts']);
  if (denied) return denied;
  return next();
}

function requireWritePages(req, res, next) {
  const denied = handlers.requireAuthWrite(req, res, ['manage_pages']);
  if (denied) return denied;
  return next();
}

function requireWriteMedia(req, res, next) {
  const denied = handlers.requireAuthWrite(req, res, ['manage_media', 'upload_media']);
  if (denied) return denied;
  return next();
}

function requireWriteMenus(req, res, next) {
  const denied = handlers.requireAuthWrite(req, res, ['manage_menus']);
  if (denied) return denied;
  return next();
}

function requireWriteWidgets(req, res, next) {
  const denied = handlers.requireAuthWrite(req, res, ['manage_banners']);
  if (denied) return denied;
  return next();
}


router.get('/search', handlers.searchContent);
router.post('/auth/token', handlers.issueAuthToken);
router.get('/pages', handlers.listPages);

router.get('/posts', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, 20);
    if (req.query.search) {
      const result = await searchPosts(req.query.search, {
        limit,
        offset,
        include: [Category, Tag, { model: TaxonomyTerm, as: 'taxonomyTerms' }],
        distinct: true,
        scopeReq: req
      });
      return res.json({ data: result.rows, meta: pageMeta(result.count, page, limit) });
    }
    const where = siteScopeWhere(req, { status: req.query.status || 'published', post_type: 'post' });
    const { rows, count } = await Post.findAndCountAll({
      where,
      include: [Category, Tag, { model: TaxonomyTerm, as: 'taxonomyTerms' }],
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
    const base = { post_type: 'post' };
    Object.assign(base, Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug });
    if (!req.query.include_draft) base.status = 'published';
    const where = siteScopeWhere(req, base);
    const post = await Post.findOne({ where, include: [Category, Tag, { model: TaxonomyTerm, as: 'taxonomyTerms' }] });
    if (!post) return handlers.apiError(res, 404, 'Post not found.');
    const embedded = await buildEmbedded(req, post, req.query._embed);
    return res.json(attachEmbed({ data: post }, embedded));
  } catch (error) {
    return next(error);
  }
});

router.get('/pages/:idOrSlug', async (req, res, next) => {
  try {
    const base = Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug };
    if (!req.query.include_draft) base.status = 'published';
    const page = await Page.findOne({ where: siteScopeWhere(req, base) });
    if (!page) return handlers.apiError(res, 404, 'Page not found.');
    const embedded = await buildEmbedded(req, page, req.query._embed);
    return res.json(attachEmbed({ data: page }, embedded));
  } catch (error) {
    return next(error);
  }
});

router.get('/types', async (req, res, next) => {
  try {
    const types = await CustomPostType.findAll({
      where: siteScopeWhere(req, { status: 'active', show_in_api: true }),
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
      where: siteScopeWhere(req, { slug: req.params.slug, status: 'active', show_in_api: true })
    });
    if (!type) return handlers.apiError(res, 404, 'Post type not found.');
    return res.json({ data: type });
  } catch (error) {
    return next(error);
  }
});

router.get('/types/:slug/content', async (req, res, next) => {
  try {
    const type = await CustomPostType.findOne({
      where: siteScopeWhere(req, { slug: req.params.slug, status: 'active', show_in_api: true })
    });
    if (!type) return handlers.apiError(res, 404, 'Post type not found.');
    const { page, limit, offset } = getPagination(req, 20);
    const { rows, count } = await Post.findAndCountAll({
      where: siteScopeWhere(req, { post_type: type.slug, status: 'published' }),
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
      where: siteScopeWhere(req, { slug: req.params.slug, status: 'active', show_in_api: true })
    });
    if (!type) return handlers.apiError(res, 404, 'Post type not found.');
    const base = { post_type: type.slug, status: 'published' };
    Object.assign(base, Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug });
    const item = await Post.findOne({
      where: siteScopeWhere(req, base),
      include: [{ model: User, as: 'author' }, { model: Category }, Tag]
    });
    if (!item) return handlers.apiError(res, 404, 'Content not found.');
    let customFields = {};
    if (type.supports_custom_fields) {
      customFields = await loadCustomFieldsMap('custom_post', item.id, 'custom_post_type', type.slug);
    }
    const embedded = await buildEmbedded(req, item, req.query._embed);
    const payload = { data: item, custom_fields: customFields };
    return res.json(attachEmbed(payload, embedded));
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', (req, res, next) => handlers.crudList(Category, req, res, next));
router.get('/categories/:idOrSlug', (req, res, next) => handlers.crudGet(Category, req, res, next, { label: 'Category' }));
router.post('/categories', requireWrite, (req, res, next) => handlers.crudCreate(Category, req, res, next, async (r) => ({
  name: r.body.name,
  slug: await handlers.createUniqueSlug(Category, r.body.slug || r.body.name, 'category'),
  description: r.body.description || null,
  parent_id: r.body.parent_id || null
}), ['manage_categories']));
router.put('/categories/:idOrSlug', requireWrite, (req, res, next) => handlers.crudUpdate(Category, req, res, next, async (r, row) => ({
  name: r.body.name ?? row.name,
  slug: r.body.slug ? await handlers.createUniqueSlug(Category, r.body.slug, 'category', row.id) : row.slug,
  description: r.body.description ?? row.description,
  parent_id: r.body.parent_id ?? row.parent_id
}), ['manage_categories']));
router.delete('/categories/:idOrSlug', requireWrite, (req, res, next) => handlers.crudDelete(Category, req, res, next, ['manage_categories']));

router.get('/tags', (req, res, next) => handlers.crudList(Tag, req, res, next));
router.get('/tags/:idOrSlug', (req, res, next) => handlers.crudGet(Tag, req, res, next, { label: 'Tag' }));
router.post('/tags', requireWrite, (req, res, next) => handlers.crudCreate(Tag, req, res, next, async (r) => ({
  name: r.body.name,
  slug: await handlers.createUniqueSlug(Tag, r.body.slug || r.body.name, 'tag'),
  description: r.body.description || null
}), ['manage_tags']));
router.put('/tags/:idOrSlug', requireWrite, (req, res, next) => handlers.crudUpdate(Tag, req, res, next, async (r, row) => ({
  name: r.body.name ?? row.name,
  slug: r.body.slug ? await handlers.createUniqueSlug(Tag, r.body.slug, 'tag', row.id) : row.slug,
  description: r.body.description ?? row.description
}), ['manage_tags']));
router.delete('/tags/:idOrSlug', requireWrite, (req, res, next) => handlers.crudDelete(Tag, req, res, next, ['manage_tags']));

router.get('/taxonomies', handlers.listTaxonomies);
router.get('/taxonomies/:slug/terms', handlers.listTaxonomyTerms);

router.get('/media', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, 20);
    const { rows, count } = await Media.findAndCountAll({
      where: siteScopeWhere(req),
      limit, offset, order: [['created_at', 'DESC']]
    });
    res.json({ data: rows, meta: pageMeta(count, page, limit) });
  } catch (error) {
    next(error);
  }
});
router.get('/media/:id', async (req, res, next) => {
  try {
    const media = await Media.findOne({ where: siteScopeWhere(req, { id: req.params.id }) });
    if (!media) return handlers.apiError(res, 404, 'Media not found.');
    return res.json({ data: media });
  } catch (error) {
    return next(error);
  }
});
router.post('/media', requireWriteMedia, upload.single('file'), handlers.createMedia);
router.put('/media/:id', requireWriteMedia, handlers.updateMedia);
router.delete('/media/:id', requireWriteMedia, handlers.deleteMedia);

router.get('/settings', async (req, res, next) => {
  try {
    const { SiteSetting } = require('../../../models');
    const rows = await SiteSetting.findAll({
      where: { key: { [Op.or]: [{ [Op.like]: 'public_%' }, 'permalink_structure', 'page_permalink_structure', 'posts_per_page'] } }
    });
    const data = rows.reduce((map, row) => ({ ...map, [row.key]: row.value }), {});
    res.json({ data });
  } catch (error) {
    next(error);
  }
});
router.put('/settings', (req, res, next) => handlers.updateSettings(req, res, next));

router.post('/posts', requireWrite, async (req, res, next) => {
  try {
    const post = await Post.create(assignSiteScope(req, {
      title: req.body.title || 'Untitled',
      slug: await handlers.createUniqueSlug(Post, req.body.slug || req.body.title, 'post', null, { post_type: 'post' }),
      content: req.body.content || '<p></p>',
      post_type: 'post',
      status: req.body.status || 'draft',
      author_id: req.body.author_id || req.session?.user?.id || null,
      category_id: req.body.category_id || null,
      seo_title: req.body.seo_title || null,
      seo_description: req.body.seo_description || null,
      published_at: req.body.status === 'published' ? new Date() : null
    }));
    if (Array.isArray(req.body.tags)) await post.setTags(req.body.tags);
    if (Array.isArray(req.body.taxonomy_terms)) await handlers.assignPostTaxonomyTerms(post, req.body.taxonomy_terms);
    return res.status(201).json({ data: post });
  } catch (error) {
    return next(error);
  }
});

router.put('/posts/:idOrSlug', requireWrite, async (req, res, next) => {
  try {
    const base = { post_type: 'post' };
    Object.assign(base, Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug });
    const post = await Post.findOne({ where: siteScopeWhere(req, base) });
    if (!post) return handlers.apiError(res, 404, 'Post not found.');
    await post.update({
      title: req.body.title ?? post.title,
      slug: req.body.slug ? await handlers.createUniqueSlug(Post, req.body.slug, 'post', post.id, { post_type: 'post' }) : post.slug,
      content: req.body.content ?? post.content,
      status: req.body.status ?? post.status,
      category_id: req.body.category_id ?? post.category_id,
      seo_title: req.body.seo_title ?? post.seo_title,
      seo_description: req.body.seo_description ?? post.seo_description
    });
    if (Array.isArray(req.body.tags)) await post.setTags(req.body.tags);
    if (Array.isArray(req.body.taxonomy_terms)) await handlers.assignPostTaxonomyTerms(post, req.body.taxonomy_terms);
    return res.json({ data: post });
  } catch (error) {
    return next(error);
  }
});

router.delete('/posts/:idOrSlug', requireWrite, async (req, res, next) => {
  try {
    const base = { post_type: 'post' };
    Object.assign(base, Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug });
    const post = await Post.findOne({ where: siteScopeWhere(req, base) });
    if (!post) return handlers.apiError(res, 404, 'Post not found.');
    await post.destroy();
    return res.json({ data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
});

router.post('/pages', requireWritePages, async (req, res, next) => {
  try {
    const page = await Page.create(assignSiteScope(req, {
      title: req.body.title || 'Untitled',
      slug: await handlers.createUniqueSlug(Page, req.body.slug || req.body.title, 'page'),
      content: req.body.content || '<p></p>',
      status: req.body.status || 'draft',
      parent_id: req.body.parent_id || null,
      menu_order: Number(req.body.menu_order) || 0,
      published_at: req.body.status === 'published' ? new Date() : null
    }));
    return res.status(201).json({ data: page });
  } catch (error) {
    return next(error);
  }
});

router.put('/pages/:idOrSlug', requireWritePages, async (req, res, next) => {
  try {
    const base = Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug };
    const page = await Page.findOne({ where: siteScopeWhere(req, base) });
    if (!page) return handlers.apiError(res, 404, 'Page not found.');
    await page.update({
      title: req.body.title ?? page.title,
      slug: req.body.slug ? await handlers.createUniqueSlug(Page, req.body.slug, 'page', page.id) : page.slug,
      content: req.body.content ?? page.content,
      status: req.body.status ?? page.status,
      parent_id: req.body.parent_id ?? page.parent_id,
      menu_order: req.body.menu_order ?? page.menu_order
    });
    return res.json({ data: page });
  } catch (error) {
    return next(error);
  }
});

router.delete('/pages/:idOrSlug', requireWritePages, async (req, res, next) => {
  try {
    const base = Number.isFinite(Number(req.params.idOrSlug)) ? { id: req.params.idOrSlug } : { slug: req.params.idOrSlug };
    const page = await Page.findOne({ where: siteScopeWhere(req, base) });
    if (!page) return handlers.apiError(res, 404, 'Page not found.');
    await page.destroy();
    return res.json({ data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
});

router.get('/comments', async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, 20);
    const commentBase = { status: req.query.status || 'approved' };
    if (req.query.post_id) commentBase.post_id = req.query.post_id;
    const where = siteScopeWhere(req, commentBase);
    const { rows, count } = await Comment.findAndCountAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    res.json({ data: rows, meta: pageMeta(count, page, limit) });
  } catch (error) {
    next(error);
  }
});
router.post('/comments', handlers.createComment);

router.put('/comments/:id', async (req, res, next) => {
  req.params.idOrSlug = req.params.id;
  const denied = handlers.requireAuthWrite(req, res, ['manage_comments']);
  if (denied) return denied;
  return handlers.crudUpdate(Comment, req, res, next, async (r, row) => ({
    status: r.body.status ?? row.status,
    content: r.body.content ?? row.content
  }), ['manage_comments']);
});

router.delete('/comments/:id', async (req, res, next) => {
  req.params.idOrSlug = req.params.id;
  const denied = handlers.requireAuthWrite(req, res, ['manage_comments']);
  if (denied) return denied;
  return handlers.crudDelete(Comment, req, res, next, ['manage_comments']);
});

router.get('/menus', handlers.listMenus);
router.get('/menus/:idOrSlug', handlers.getMenu);
router.post('/menus', requireWriteMenus, handlers.createMenu);
router.put('/menus/:idOrSlug', requireWriteMenus, handlers.updateMenu);
router.post('/menus/:idOrSlug/items', requireWriteMenus, handlers.createMenuItem);

router.get('/widgets', handlers.listWidgets);
router.post('/widgets/instances', requireWriteWidgets, handlers.createWidgetInstance);
router.put('/widgets/instances/:id', requireWriteWidgets, (req, res, next) => {
  req.params.idOrSlug = req.params.id;
  return handlers.updateWidgetInstance(req, res, next);
});
router.delete('/widgets/instances/:id', requireWriteWidgets, handlers.deleteWidgetInstance);

module.exports = router;
