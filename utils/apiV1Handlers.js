const { Op } = require('sequelize');
const {
  Post, Page, Category, Tag, CustomPostType, Media, Comment, Menu, MenuItem,
  WidgetArea, WidgetInstance, SiteSetting, Taxonomy, TaxonomyTerm
} = require('../models');
const { getPagination, pageMeta } = require('./pagination');
const { loadCustomFieldsMap } = require('./customFields');
const { createUniqueSlug } = require('./slugGenerator');
const policy = require('./policy');
const { searchPostsList, searchPages } = require('./searchHelper');
const { validateCommentParent } = require('./commentDepthHelper');
const { buildMenuTree } = require('../middleware/siteContext');
const { siteScopeWhere, assignSiteScope, isSiteScopedModel } = require('./siteScope');
const { hasApiScope } = require('./jwtToken');
const { buildEmbedded, attachEmbed } = require('./apiEmbed');

function apiError(res, status, message, details = null) {
  const body = { error: { code: status, message } };
  if (details) body.error.details = details;
  return res.status(status).json(body);
}

function idOrSlugWhere(param) {
  return Number.isFinite(Number(param)) ? { id: Number(param) } : { slug: param };
}

function requireAuthWrite(req, res, permissions = ['manage_posts']) {
  if (!req.apiUser && !req.session?.user) {
    return apiError(res, 401, 'Authentication required for write operations.');
  }
  if (req.apiUser) {
    if (req.apiUser.auth === 'api_key' || hasApiScope(req.apiUser, permissions)) {
      return null;
    }
    return apiError(res, 403, 'Insufficient API token scopes.');
  }
  if (policy.isSuperAdmin(req.session?.user) || permissions.some((p) => policy.hasPermission(req.session?.user, p))) {
    return null;
  }
  return apiError(res, 403, 'Insufficient permissions.');
}

async function issueAuthToken(req, res, next) {
  try {
    const { signJwt, API_SCOPES, normalizeScopes } = require('./jwtToken');
    const scopes = normalizeScopes(req.body.scopes || req.body.scope || 'read');
    const invalid = scopes.filter((s) => !API_SCOPES.includes(s));
    if (invalid.length) {
      return apiError(res, 400, `Invalid scopes: ${invalid.join(', ')}`);
    }
    const token = signJwt({
      sub: req.body.sub || 'api-client',
      scopes
    }, { expiresInSec: Math.min(Number(req.body.expires_in) || 3600, 86400) });
    return res.json({
      data: {
        token_type: 'Bearer',
        access_token: token,
        expires_in: Math.min(Number(req.body.expires_in) || 3600, 86400),
        scopes
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function searchContent(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ data: { posts: [], pages: [] } });
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const [posts, pages] = await Promise.all([
      searchPostsList(q, { limit, scopeReq: req }),
      searchPages(q, { limit: Math.min(limit, 10), scopeReq: req })
    ]);
    return res.json({ data: { query: q, posts, pages } });
  } catch (error) {
    return next(error);
  }
}

async function listPages(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, 20);
    const status = req.query.status || 'published';
    const where = siteScopeWhere(req, { status });
    if (req.query.search) {
      const rows = await searchPages(req.query.search, { limit, status, scopeReq: req });
      return res.json({ data: rows, meta: pageMeta(rows.length, page, limit) });
    }
    const { rows, count } = await Page.findAndCountAll({
      where,
      include: [{ model: Page, as: 'parent', attributes: ['id', 'title', 'slug'] }],
      limit,
      offset,
      order: [['menu_order', 'ASC'], ['updated_at', 'DESC']]
    });
    return res.json({ data: rows, meta: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function crudList(Model, req, res, next, options = {}) {
  try {
    const { page, limit, offset } = getPagination(req, options.limit || 20);
    const where = siteScopeWhere(req, options.where ? options.where(req) : {});
    const { rows, count } = await Model.findAndCountAll({
      where,
      include: options.include || [],
      limit,
      offset,
      order: options.order || [['name', 'ASC']]
    });
    return res.json({ data: rows, meta: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function crudGet(Model, req, res, next, options = {}) {
  try {
    const where = siteScopeWhere(req, { ...idOrSlugWhere(req.params.idOrSlug), ...(options.extraWhere || {}) });
    const row = await Model.findOne({ where, include: options.include || [] });
    if (!row) return apiError(res, 404, `${options.label || 'Resource'} not found.`);
    return res.json({ data: row });
  } catch (error) {
    return next(error);
  }
}

async function crudCreate(Model, req, res, next, buildPayload, permission) {
  try {
    const denied = requireAuthWrite(req, res, permission);
    if (denied) return denied;
    let payload = await buildPayload(req);
    if (isSiteScopedModel(Model)) payload = assignSiteScope(req, payload);
    const row = await Model.create(payload);
    return res.status(201).json({ data: row });
  } catch (error) {
    return next(error);
  }
}

async function crudUpdate(Model, req, res, next, buildPayload, permission, extraWhere = {}) {
  try {
    const denied = requireAuthWrite(req, res, permission);
    if (denied) return denied;
    const where = siteScopeWhere(req, { ...idOrSlugWhere(req.params.idOrSlug), ...extraWhere });
    const row = await Model.findOne({ where });
    if (!row) return apiError(res, 404, 'Resource not found.');
    await row.update(await buildPayload(req, row));
    return res.json({ data: row });
  } catch (error) {
    return next(error);
  }
}

async function crudDelete(Model, req, res, next, permission, extraWhere = {}) {
  try {
    const denied = requireAuthWrite(req, res, permission);
    if (denied) return denied;
    const where = siteScopeWhere(req, { ...idOrSlugWhere(req.params.idOrSlug), ...extraWhere });
    const row = await Model.findOne({ where });
    if (!row) return apiError(res, 404, 'Resource not found.');
    await row.destroy();
    return res.json({ data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
}

async function listMenus(req, res, next) {
  try {
    const menus = await Menu.findAll({
      where: siteScopeWhere(req),
      include: [{ model: MenuItem, as: 'items', separate: true, order: [['display_order', 'ASC']] }],
      order: [['name', 'ASC']]
    });
    const data = menus.map((menu) => {
      const plain = menu.get({ plain: true });
      plain.itemsTree = buildMenuTree(menu.items || []);
      return plain;
    });
    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function getMenu(req, res, next) {
  try {
    const where = siteScopeWhere(req, idOrSlugWhere(req.params.idOrSlug));
    const menu = await Menu.findOne({
      where,
      include: [{ model: MenuItem, as: 'items', separate: true, order: [['display_order', 'ASC']] }]
    });
    if (!menu) return apiError(res, 404, 'Menu not found.');
    const plain = menu.get({ plain: true });
    plain.itemsTree = buildMenuTree(menu.items || []);
    return res.json({ data: plain });
  } catch (error) {
    return next(error);
  }
}

async function listTaxonomies(req, res, next) {
  try {
    const where = siteScopeWhere(req, { status: 'active', show_in_api: true });
    const rows = await Taxonomy.findAll({ where, order: [['name', 'ASC']] });
    return res.json({ data: rows });
  } catch (error) {
    return next(error);
  }
}

async function listTaxonomyTerms(req, res, next) {
  try {
    const taxonomy = await Taxonomy.findOne({ where: siteScopeWhere(req, { slug: req.params.slug, status: 'active' }) });
    if (!taxonomy) return apiError(res, 404, 'Taxonomy not found.');
    const terms = await TaxonomyTerm.findAll({
      where: { taxonomy_id: taxonomy.id },
      order: [['name', 'ASC']]
    });
    return res.json({ data: terms, taxonomy: { slug: taxonomy.slug, name: taxonomy.name } });
  } catch (error) {
    return next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const denied = requireAuthWrite(req, res, ['manage_settings']);
    if (denied) return denied;
    const allowed = Object.keys(req.body || {}).filter((k) => k.startsWith('public_') || ['permalink_structure', 'page_permalink_structure', 'posts_per_page', 'revision_limit', 'comment_max_depth'].includes(k));
    for (const key of allowed) {
      await SiteSetting.upsert({ key, value: String(req.body[key] ?? ''), group: key.startsWith('public_') ? 'public' : 'seo' });
    }
    return res.json({ data: { updated: allowed } });
  } catch (error) {
    return next(error);
  }
}

async function createComment(req, res, next) {
  try {
    const post = await Post.findOne({ where: siteScopeWhere(req, { id: req.body.post_id, status: 'published' }) });
    if (!post) return apiError(res, 404, 'Post not found.');
    if (post.allow_comments === false) return apiError(res, 403, 'Comments are closed for this post.');
    const parentId = req.body.parent_id ? Number(req.body.parent_id) : null;
    const depthCheck = await validateCommentParent(parentId, post.id);
    if (!depthCheck.valid) return apiError(res, 400, depthCheck.error);
    const comment = await Comment.create(assignSiteScope(req, {
      post_id: post.id,
      parent_id: parentId,
      name: String(req.body.name || '').slice(0, 120),
      email: String(req.body.email || '').slice(0, 180),
      website: req.body.website || null,
      content: String(req.body.content || '').slice(0, 3000),
      status: 'pending',
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    }));
    return res.status(201).json({ data: comment });
  } catch (error) {
    return next(error);
  }
}

async function createMedia(req, res, next) {
  try {
    const denied = requireAuthWrite(req, res, ['manage_media', 'upload_media']);
    if (denied) return denied;
    if (!req.file) return apiError(res, 400, 'No file uploaded.');
    const { finalizeQuarantinedUpload } = require('./uploadSecurity');
    const { buildMediaPayload } = require('./mediaHelper');
    const processed = await finalizeQuarantinedUpload(req.file);
    const userId = req.apiUser?.id || req.session?.user?.id || null;
    const media = await Media.create(assignSiteScope(req, await buildMediaPayload(processed, userId)));
    return res.status(201).json({ data: media });
  } catch (error) {
    return next(error);
  }
}

async function updateMedia(req, res, next) {
  try {
    const denied = requireAuthWrite(req, res, ['manage_media', 'upload_media']);
    if (denied) return denied;
    const media = await Media.findOne({ where: siteScopeWhere(req, { id: req.params.id }) });
    if (!media) return apiError(res, 404, 'Media not found.');
    await media.update({
      alt_text: req.body.alt_text ?? media.alt_text,
      caption: req.body.caption ?? media.caption,
      description: req.body.description ?? media.description,
      title: req.body.title ?? media.title
    });
    return res.json({ data: media });
  } catch (error) {
    return next(error);
  }
}

async function deleteMedia(req, res, next) {
  try {
    const denied = requireAuthWrite(req, res, ['manage_media']);
    if (denied) return denied;
    const media = await Media.findOne({ where: siteScopeWhere(req, { id: req.params.id }) });
    if (!media) return apiError(res, 404, 'Media not found.');
    const { removeMediaFiles } = require('./mediaHelper');
    await removeMediaFiles(media);
    await media.destroy();
    return res.json({ data: { deleted: true } });
  } catch (error) {
    return next(error);
  }
}

async function listWidgets(req, res, next) {
  try {
    const areas = await WidgetArea.findAll({
      where: siteScopeWhere(req, { status: 'active' }),
      include: [{ model: WidgetInstance, as: 'widgets', separate: true, order: [['display_order', 'ASC']] }],
      order: [['display_order', 'ASC']]
    });
    return res.json({ data: areas });
  } catch (error) {
    return next(error);
  }
}

async function createWidgetInstance(req, res, next) {
  try {
    const denied = requireAuthWrite(req, res, ['manage_banners']);
    if (denied) return denied;
    const area = await WidgetArea.findOne({ where: siteScopeWhere(req, { id: req.body.widget_area_id }) });
    if (!area) return apiError(res, 404, 'Widget area not found.');
    const instance = await WidgetInstance.create({
      widget_area_id: area.id,
      widget_type: req.body.widget_type || 'text',
      title: req.body.title || '',
      settings_json: req.body.settings_json ? JSON.stringify(req.body.settings_json) : null,
      display_order: Number(req.body.display_order) || 0,
      active: req.body.active !== false
    });
    return res.status(201).json({ data: instance });
  } catch (error) {
    return next(error);
  }
}

async function updateWidgetInstance(req, res, next) {
  return crudUpdate(WidgetInstance, req, res, next, async (r, row) => ({
    title: r.body.title ?? row.title,
    settings_json: r.body.settings_json ? JSON.stringify(r.body.settings_json) : row.settings_json,
    display_order: r.body.display_order ?? row.display_order,
    active: r.body.active ?? row.active
  }), ['manage_banners']);
}

async function deleteWidgetInstance(req, res, next) {
  req.params.idOrSlug = req.params.id;
  return crudDelete(WidgetInstance, req, res, next, ['manage_banners']);
}

async function createMenu(req, res, next) {
  return crudCreate(Menu, req, res, next, async (r) => ({
    name: r.body.name,
    slug: await createUniqueSlug(Menu, r.body.slug || r.body.name, 'menu'),
    location: r.body.location || null,
    active: r.body.active !== false
  }), ['manage_menus']);
}

async function updateMenu(req, res, next) {
  return crudUpdate(Menu, req, res, next, async (r, row) => ({
    name: r.body.name ?? row.name,
    slug: r.body.slug ? await createUniqueSlug(Menu, r.body.slug, 'menu', row.id) : row.slug,
    location: r.body.location ?? row.location,
    active: r.body.active ?? row.active
  }), ['manage_menus']);
}

async function createMenuItem(req, res, next) {
  try {
    const denied = requireAuthWrite(req, res, ['manage_menus']);
    if (denied) return denied;
    const menu = await Menu.findOne({ where: siteScopeWhere(req, idOrSlugWhere(req.params.idOrSlug)) });
    if (!menu) return apiError(res, 404, 'Menu not found.');
    const item = await MenuItem.create({
      menu_id: menu.id,
      parent_id: req.body.parent_id || null,
      title: String(req.body.title || '').slice(0, 120),
      url: req.body.url || '',
      item_type: req.body.item_type || 'custom',
      reference_id: req.body.reference_id || null,
      target: req.body.target || '_self',
      display_order: Number(req.body.display_order) || 0,
      active: req.body.active !== false
    });
    return res.status(201).json({ data: item });
  } catch (error) {
    return next(error);
  }
}

async function assignPostTaxonomyTerms(post, termIds) {
  if (!Array.isArray(termIds)) return;
  const ids = termIds.map((id) => Number(id)).filter(Boolean);
  await post.setTaxonomyTerms(ids);
}

module.exports = {
  apiError,
  requireAuthWrite,
  issueAuthToken,
  searchContent,
  listPages,
  crudList,
  crudGet,
  crudCreate,
  crudUpdate,
  crudDelete,
  listMenus,
  getMenu,
  createMenu,
  updateMenu,
  createMenuItem,
  listTaxonomies,
  listTaxonomyTerms,
  updateSettings,
  createComment,
  createMedia,
  updateMedia,
  deleteMedia,
  listWidgets,
  createWidgetInstance,
  updateWidgetInstance,
  deleteWidgetInstance,
  assignPostTaxonomyTerms,
  createUniqueSlug
};
