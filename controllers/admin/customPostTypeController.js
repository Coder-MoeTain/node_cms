const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../../models');
const { createUniqueSlug } = require('../../utils/slugGenerator');
const policy = require('../../utils/policy');
const {
  DEFAULT_TYPES,
  ICON_PRESETS,
  SUPPORT_FLAGS,
  enrichContentType,
  loadContentTypeCounts
} = require('../../utils/contentTypeRegistry');

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

    const query = req.query.q || '';
    const where = query
      ? { [Op.or]: [{ name: { [Op.like]: `%${query}%` } }, { slug: { [Op.like]: `%${query}%` } }] }
      : {};

    const [rows, counts] = await Promise.all([
      models.CustomPostType.findAll({ where, order: [['name', 'ASC']] }),
      loadContentTypeCounts(models)
    ]);

    const enriched = rows.map((row) => enrichContentType(row, counts));
    const stats = {
      total: enriched.length,
      active: enriched.filter((row) => row.status === 'active').length,
      inMenu: enriched.filter((row) => row.show_in_menu && row.status === 'active').length,
      totalItems: enriched.reduce((sum, row) => sum + row.itemCount, 0)
    };

    return res.render('admin/custom-post-types/index', {
      title: 'Content Types',
      rows: enriched,
      query,
      stats,
      canManageContent: policy.hasAnyPermission(req.session.user, [
        'manage_custom_content', 'manage_posts', 'create_posts', 'edit_posts'
      ])
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
    return res.render('admin/custom-post-types/form', {
      title: 'Add Content Type',
      record: {},
      iconPresets: ICON_PRESETS,
      supportFlags: SUPPORT_FLAGS
    });
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
    req.flash('success', 'Content type created.');
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

    const counts = await loadContentTypeCounts(models);
    const enriched = enrichContentType(record, counts);

    return res.render('admin/custom-post-types/form', {
      title: `Edit Content Type — ${record.name}`,
      record: enriched,
      iconPresets: ICON_PRESETS,
      supportFlags: SUPPORT_FLAGS
    });
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
    req.flash('success', 'Content type updated.');
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
    req.flash('success', 'Content type deleted.');
    return res.redirect('/admin/custom-post-types');
  } catch (error) {
    return next(error);
  }
}

async function seedDefaults(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }

    let created = 0;
    for (const preset of DEFAULT_TYPES) {
      const [, wasCreated] = await models.CustomPostType.findOrCreate({
        where: { slug: preset.slug },
        defaults: {
          name: preset.name,
          description: preset.description,
          icon: preset.icon,
          supports_title: true,
          supports_editor: true,
          supports_excerpt: preset.supports_excerpt !== false,
          supports_featured_image: true,
          supports_comments: preset.supports_comments === true,
          supports_revisions: true,
          supports_custom_fields: true,
          has_archive: preset.has_archive !== false,
          show_in_menu: true,
          show_in_api: true,
          status: 'active'
        }
      });
      if (wasCreated) created += 1;
    }

    req.flash('success', created
      ? `Added ${created} starter content type${created === 1 ? '' : 's'} (News, Events, Jobs).`
      : 'Starter content types already exist.');
    return res.redirect('/admin/custom-post-types');
  } catch (error) {
    return next(error);
  }
}

async function duplicate(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_custom_post_types')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/custom-post-types');
    }

    const record = await models.CustomPostType.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    const baseSlug = `${record.slug}-copy`;
    const slug = await createUniqueSlug(models.CustomPostType, baseSlug, 'type');
    await models.CustomPostType.create({
      name: `${record.name} (Copy)`,
      slug,
      description: record.description,
      icon: record.icon,
      supports_title: record.supports_title,
      supports_editor: record.supports_editor,
      supports_excerpt: record.supports_excerpt,
      supports_featured_image: record.supports_featured_image,
      supports_comments: record.supports_comments,
      supports_revisions: record.supports_revisions,
      supports_custom_fields: record.supports_custom_fields,
      has_archive: record.has_archive,
      show_in_menu: false,
      show_in_api: record.show_in_api,
      status: 'inactive'
    });

    req.flash('success', 'Content type duplicated as inactive copy.');
    return res.redirect('/admin/custom-post-types');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  create,
  store,
  edit,
  update,
  destroy,
  seedDefaults,
  duplicate
};
