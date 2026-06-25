const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../../models');
const { createUniqueSlug } = require('../../utils/slugGenerator');
const { getPagination, pageMeta } = require('../../utils/pagination');
const policy = require('../../utils/policy');

function sanitizeText(value, max = 500) {
  return sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).slice(0, max);
}

function boolField(body, name, defaultValue = true) {
  if (body[name] === undefined) return defaultValue;
  return body[name] === 'on' || body[name] === '1' || body[name] === true;
}

function payloadFromBody(body, record = null) {
  return {
    name: sanitizeText(body.name, 120),
    description: sanitizeText(body.description, 2000),
    icon: sanitizeText(body.icon || 'bi-file-earmark', 80),
    supports_title: boolField(body, 'supports_title'),
    supports_editor: boolField(body, 'supports_editor'),
    supports_excerpt: boolField(body, 'supports_excerpt'),
    supports_featured_image: boolField(body, 'supports_featured_image'),
    supports_comments: boolField(body, 'supports_comments', false),
    supports_revisions: boolField(body, 'supports_revisions'),
    supports_custom_fields: boolField(body, 'supports_custom_fields'),
    has_archive: boolField(body, 'has_archive'),
    show_in_menu: boolField(body, 'show_in_menu'),
    show_in_api: boolField(body, 'show_in_api'),
    status: body.status === 'inactive' ? 'inactive' : 'active',
    slug: body.slug || body.name
  };
}

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission to manage custom post types.');
      return res.redirect('/admin');
    }
    const { page, limit, offset } = getPagination(req, 20);
    const query = req.query.q || '';
    const where = query ? { [Op.or]: [{ name: { [Op.like]: `%${query}%` } }, { slug: { [Op.like]: `%${query}%` } }] } : {};
    const { rows, count } = await models.CustomPostType.findAndCountAll({
      where,
      limit,
      offset,
      order: [['name', 'ASC']]
    });
    return res.render('admin/custom-post-types/index', {
      title: 'Custom Post Types',
      rows,
      query,
      pagination: pageMeta(count, page, limit)
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }
    return res.render('admin/custom-post-types/form', { title: 'Add Custom Post Type', record: {} });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }
    const data = payloadFromBody(req.body);
    data.slug = await createUniqueSlug(models.CustomPostType, data.slug || data.name, 'type');
    await models.CustomPostType.create(data);
    req.flash('success', 'Custom post type created.');
    return res.redirect('/admin/custom-post-types');
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }
    const record = await models.CustomPostType.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    return res.render('admin/custom-post-types/form', { title: 'Edit Custom Post Type', record });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }
    const record = await models.CustomPostType.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    const data = payloadFromBody(req.body, record);
    data.slug = await createUniqueSlug(models.CustomPostType, data.slug || data.name, 'type', record.id);
    await record.update(data);
    req.flash('success', 'Custom post type updated.');
    return res.redirect('/admin/custom-post-types');
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }
    const record = await models.CustomPostType.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    const count = await models.Post.count({ where: { post_type: record.slug } });
    if (count > 0) {
      req.flash('error', `Cannot delete: ${count} item(s) still use this post type. Deactivate instead.`);
      return res.redirect('/admin/custom-post-types');
    }
    await record.destroy();
    req.flash('success', 'Custom post type deleted.');
    return res.redirect('/admin/custom-post-types');
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, create, store, edit, update, destroy };
