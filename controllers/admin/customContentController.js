const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../../models');
const { createUniqueSlug } = require('../../utils/slugGenerator');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { resolveImageValue } = require('../../utils/uploadHelper');
const { normalizeUploadUrlsInHtml } = require('../../utils/mediaHelper');
const policy = require('../../utils/policy');
const {
  loadFieldGroupsForLocation,
  loadCustomFieldsMap,
  saveCustomFieldValues
} = require('../../utils/customFields');
const { saveRevision } = require('../../utils/revisionHelper');
const { renderBlocks } = require('../../utils/blockRenderer');
const { loadTranslations, saveTranslations, TRANSLATION_LOCALES } = require('../../utils/contentTranslationStore');
const { parseDatetimeLocal, resolveSiteTimezone } = require('../../utils/timezoneHelper');

function resolvePublishedAt(body, req, status) {
  if (body.published_at) {
    const tz = resolveSiteTimezone(req.res?.locals?.siteSettings);
    return parseDatetimeLocal(body.published_at, tz);
  }
  return status === 'published' ? new Date() : null;
}

const richTextSanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'iframe']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder']
  },
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'player.vimeo.com']
};

function sanitizePlainText(value, maxLength = 1000) {
  return sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).slice(0, maxLength);
}

async function loadType(req) {
  const type = await models.CustomPostType.findOne({
    where: { slug: req.params.typeSlug, status: 'active' }
  });
  if (!type) {
    const error = new Error('Custom post type not found.');
    error.status = 404;
    throw error;
  }
  return type;
}

function canManageType(user, type, action = 'index') {
  if (policy.isSuperAdmin(user)) return true;
  if (action === 'index' || action === 'edit' || action === 'update') {
    return policy.hasAnyPermission(user, ['manage_custom_content', 'manage_posts', 'create_posts', 'edit_posts']);
  }
  if (action === 'create' || action === 'store') {
    return policy.hasAnyPermission(user, ['manage_custom_content', 'create_posts', 'manage_posts']);
  }
  if (action === 'destroy') {
    return policy.hasAnyPermission(user, ['manage_custom_content', 'delete_posts', 'manage_posts']);
  }
  return false;
}

function allowedStatus(body, req, record = null) {
  const status = body.status || 'draft';
  if (status === 'draft') return 'draft';
  if (!policy.canPublishPost(req.session.user, record) && !policy.hasPermission(req.session.user, 'manage_custom_content')) {
    return record?.status || 'draft';
  }
  return status;
}

async function buildPayload(body, req, type, record = null, transaction = null) {
  const status = allowedStatus(body, req, record);
  const content = type.supports_editor
    ? sanitizeHtml(normalizeUploadUrlsInHtml(body.content || ''), richTextSanitizeOptions)
    : sanitizePlainText(body.content, 50000);
  const payload = {
    title: type.supports_title ? sanitizePlainText(body.title, 220) : sanitizePlainText(type.name, 220),
    slug: await createUniqueSlug(
      models.Post,
      body.slug || body.title,
      type.slug,
      record?.id,
      { post_type: type.slug }
    ),
    post_type: type.slug,
    content: content || '<p></p>',
    excerpt: type.supports_excerpt ? sanitizePlainText(body.excerpt, 1000) : '',
    status,
    author_id: req.session.user.id,
    seo_title: sanitizePlainText(body.seo_title, 220),
    seo_description: sanitizePlainText(body.seo_description, 1000),
    og_image: sanitizePlainText(body.og_image, 255),
    allow_comments: type.supports_comments && body.allow_comments === 'on',
    published_at: resolvePublishedAt(body, req, status)
  };

  if (type.supports_featured_image) {
    payload.featured_image = await resolveImageValue(req, {
      fileField: 'featured_image_file',
      pathField: 'featured_image',
      record,
      transaction
    });
  }

  if (body.content_format === 'block' && body.block_content_json) {
    payload.content_format = 'block';
    payload.block_content_json = body.block_content_json;
    payload.rendered_content_cache = renderBlocks(body.block_content_json);
    payload.content = payload.rendered_content_cache || payload.content;
  }

  return payload;
}

async function index(req, res, next) {
  try {
    const type = await loadType(req);
    if (!canManageType(req.session.user, type, 'index')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const { page, limit, offset } = getPagination(req, 10);
    const query = req.query.q || '';
    const where = { post_type: type.slug };
    if (query) {
      where[Op.or] = [
        { title: { [Op.like]: `%${query}%` } },
        { slug: { [Op.like]: `%${query}%` } }
      ];
    }
    if (req.query.status) where.status = req.query.status;
    const { fn, col } = models.sequelize;
    const { rows, count } = await models.Post.findAndCountAll({
      where,
      include: [{ model: models.User, as: 'author' }],
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });
    const statusCountRows = await models.Post.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      where: { post_type: type.slug },
      group: ['status'],
      raw: true
    });
    const statusCounts = Object.fromEntries(statusCountRows.map((row) => [row.status, Number(row.count)]));
    const totalItems = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);

    return res.render('admin/custom-content/index', {
      title: type.name,
      type,
      rows,
      query,
      pagination: pageMeta(count, page, limit),
      filters: { status: req.query.status || '' },
      statusCounts,
      totalItems
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const type = await loadType(req);
    if (!canManageType(req.session.user, type, 'create')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect(`/admin/content/${type.slug}`);
    }
    const fieldGroups = type.supports_custom_fields
      ? await loadFieldGroupsForLocation('custom_post_type', type.slug)
      : [];
    return res.render('admin/custom-content/form', {
      title: `Add ${type.name}`,
      type,
      record: {},
      fieldGroups,
      customFieldValues: {},
      translations: {},
      translationLocales: TRANSLATION_LOCALES
    });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    const type = await loadType(req);
    if (!canManageType(req.session.user, type, 'store')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect(`/admin/content/${type.slug}`);
    }
    let record;
    await models.sequelize.transaction(async (transaction) => {
      const payload = await buildPayload(req.body, req, type, null, transaction);
      record = await models.Post.create(payload, { transaction });
      if (type.supports_custom_fields) {
        await saveCustomFieldValues('custom_post', record.id, req.body, 'custom_post_type', type.slug, transaction);
      }
      await saveTranslations('custom_post', record.id, req.body, transaction);
    });
    req.flash('success', `${type.name} item saved.`);
    return res.redirect(`/admin/content/${type.slug}`);
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    const type = await loadType(req);
    if (!canManageType(req.session.user, type, 'edit')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect(`/admin/content/${type.slug}`);
    }
    const record = await models.Post.findOne({
      where: { id: req.params.id, post_type: type.slug },
      include: [{ model: models.User, as: 'author' }]
    });
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    const fieldGroups = type.supports_custom_fields
      ? await loadFieldGroupsForLocation('custom_post_type', type.slug)
      : [];
    const customFieldValues = type.supports_custom_fields
      ? await loadCustomFieldsMap('custom_post', record.id, 'custom_post_type', type.slug)
      : {};
    const translations = await loadTranslations('custom_post', record.id);
    return res.render('admin/custom-content/form', {
      title: `Edit ${type.name}`,
      type,
      record,
      fieldGroups,
      customFieldValues,
      translations,
      translationLocales: TRANSLATION_LOCALES
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const type = await loadType(req);
    if (!canManageType(req.session.user, type, 'update')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect(`/admin/content/${type.slug}`);
    }
    const record = await models.Post.findOne({ where: { id: req.params.id, post_type: type.slug } });
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    await models.sequelize.transaction(async (transaction) => {
      if (type.supports_revisions) {
        await saveRevision('custom_post', record.id, {
          title: record.title,
          content: record.content,
          excerpt: record.excerpt,
          block_content_json: record.block_content_json,
          meta_json: { seo_title: record.seo_title, seo_description: record.seo_description }
        }, req.session.user.id, transaction);
      }
      const payload = await buildPayload(req.body, req, type, record, transaction);
      await record.update(payload, { transaction });
      if (type.supports_custom_fields) {
        await saveCustomFieldValues('custom_post', record.id, req.body, 'custom_post_type', type.slug, transaction);
      }
      await saveTranslations('custom_post', record.id, req.body, transaction);
    });
    req.flash('success', `${type.name} item updated.`);
    return res.redirect(`/admin/content/${type.slug}`);
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const type = await loadType(req);
    if (!canManageType(req.session.user, type, 'destroy')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect(`/admin/content/${type.slug}`);
    }
    const record = await models.Post.findOne({ where: { id: req.params.id, post_type: type.slug } });
    if (record) await record.destroy();
    req.flash('success', 'Item deleted.');
    return res.redirect(`/admin/content/${type.slug}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, create, store, edit, update, destroy, loadType };
