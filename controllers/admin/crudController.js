const bcrypt = require('bcrypt');
const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../../models');
const { resolveImageValue } = require('../../utils/uploadHelper');
const { resolveSliderImages } = require('../../utils/sliderHelper');
const { normalizeUploadUrlsInHtml } = require('../../utils/mediaHelper');
const { createSlug, createUniqueSlug } = require('../../utils/slugGenerator');
const { getPagination, pageMeta } = require('../../utils/pagination');
const policy = require('../../utils/policy');
const pluginLoader = require('../../utils/pluginLoader');
const { saveRevision } = require('../../utils/revisionHelper');
const { renderBlocks, validateBlockSchema } = require('../../utils/blockRenderer');
const { loadTranslations, saveTranslations, TRANSLATION_LOCALES } = require('../../utils/contentTranslationStore');
const { buildPreviewUrl } = require('../../utils/previewHelper');

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

function applyBlockContent(body, payload) {
  if (body.content_format === 'block' && body.block_content_json) {
    const validation = validateBlockSchema(body.block_content_json);
    if (validation.valid) {
      payload.content_format = 'block';
      payload.block_content_json = JSON.stringify(validation.blocks);
      payload.rendered_content_cache = renderBlocks(validation.blocks);
      payload.content = payload.rendered_content_cache || payload.content;
      return payload;
    }
  }
  payload.content_format = body.content_format === 'block' ? 'block' : 'classic';
  return payload;
}

async function saveContentRevision(resource, record, userId, transaction) {
  const type = resource === 'pages' ? 'page' : 'post';
  await saveRevision(type, record.id, {
    title: record.title,
    content: record.content,
    excerpt: record.excerpt,
    block_content_json: record.block_content_json,
    meta_json: { seo_title: record.seo_title, seo_description: record.seo_description }
  }, userId, transaction);
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function sanitizePlainText(value, maxLength = 1000) {
  return sanitizeHtml(value || '', { allowedTags: [], allowedAttributes: {} }).slice(0, maxLength);
}

function allowedStatus(body, req, record = null) {
  const status = body.status || 'draft';
  if (status === 'draft') return 'draft';
  if (!policy.canPublishPost(req.session.user, record) && !policy.hasPermission(req.session.user, 'manage_pages')) {
    return record?.status || 'draft';
  }
  return status;
}

async function ensureUserMutationAllowed(req, payload, record = null) {
  const targetRole = payload.role_id ? await models.Role.findByPk(payload.role_id) : null;
  const currentUser = req.session.user;

  if (targetRole?.slug === 'super-admin' && !policy.isSuperAdmin(currentUser)) {
    const error = new Error('Only Super Admins can assign the Super Admin role.');
    error.status = 403;
    throw error;
  }
  if (targetRole && !policy.canAssignRole(currentUser, targetRole.slug)) {
    const error = new Error('You cannot assign that role.');
    error.status = 403;
    throw error;
  }

  if (record) {
    const existing = await models.User.findByPk(record.id, { include: [models.Role] });
    if (!policy.canManageUser(currentUser, existing)) {
      const error = new Error('You cannot manage this user.');
      error.status = 403;
      throw error;
    }
    if (Number(record.id) === Number(currentUser.id) && payload.status && payload.status !== 'active') {
      const error = new Error('You cannot disable your own account.');
      error.status = 400;
      throw error;
    }
  }
}

async function ensureNotLastSuperAdmin(record) {
  if (!record) return;
  const current = await models.User.findByPk(record.id, { include: [models.Role] });
  if (current?.Role?.slug !== 'super-admin') return;
  const superAdminRole = await models.Role.findOne({ where: { slug: 'super-admin' } });
  const count = await models.User.count({ where: { role_id: superAdminRole.id, status: 'active' } });
  if (count <= 1) {
    const error = new Error('Cannot modify or delete the last active Super Admin.');
    error.status = 400;
    throw error;
  }
}

const configs = {
  posts: {
    model: models.Post,
    title: 'Posts',
    permission: 'manage_posts',
    searchFields: ['title', 'slug', 'excerpt'],
    include: [{ model: models.Category }, { model: models.User, as: 'author' }, models.Tag],
    formData: async () => ({ categories: await models.Category.findAll(), tags: await models.Tag.findAll(), users: await models.User.findAll() }),
    payload: async (body, req, record = null, transaction = null) => {
      const status = allowedStatus(body, req, record);
      const canAssignAuthor = policy.can(req.session.user, 'manage_posts');
      const payload = applyBlockContent(body, {
        title: sanitizePlainText(body.title, 220),
        slug: await createUniqueSlug(models.Post, body.slug || body.title, 'post', record?.id, { post_type: 'post' }),
        post_type: 'post',
        content: sanitizeHtml(normalizeUploadUrlsInHtml(body.content || ''), richTextSanitizeOptions),
        excerpt: sanitizePlainText(body.excerpt, 1000),
        featured_image: await resolveImageValue(req, {
          fileField: 'featured_image_file',
          pathField: 'featured_image',
          record,
          transaction
        }),
        video_url: sanitizePlainText(body.video_url, 500),
        status,
        category_id: body.category_id || null,
        author_id: canAssignAuthor ? body.author_id || req.session.user.id : req.session.user.id,
        seo_title: sanitizePlainText(body.seo_title, 220),
        seo_description: sanitizePlainText(body.seo_description, 1000),
        og_image: sanitizePlainText(body.og_image, 255),
        allow_comments: body.allow_comments === 'on',
        published_at: body.published_at || (status === 'published' ? new Date() : null)
      });
      return payload;
    },
    afterSave: async (record, body, transaction = null) => record.setTags(normalizeArray(body.tags), { transaction })
  },
  pages: {
    model: models.Page,
    title: 'Pages',
    permission: 'manage_pages',
    searchFields: ['title', 'slug', 'excerpt'],
    include: [{ model: models.User, as: 'author' }],
    payload: async (body, req, record = null, transaction = null) => applyBlockContent(body, {
      title: sanitizePlainText(body.title, 220),
      slug: await createUniqueSlug(models.Page, body.slug || body.title, 'page', record?.id),
      content: sanitizeHtml(normalizeUploadUrlsInHtml(body.content || ''), richTextSanitizeOptions),
      excerpt: sanitizePlainText(body.excerpt, 1000),
      featured_image: await resolveImageValue(req, {
        fileField: 'featured_image_file',
        pathField: 'featured_image',
        record,
        transaction
      }),
      status: allowedStatus(body, req, record),
      seo_title: sanitizePlainText(body.seo_title, 220),
      seo_description: sanitizePlainText(body.seo_description, 1000),
      og_image: sanitizePlainText(body.og_image, 255),
      author_id: record?.author_id || req.session.user.id,
      published_at: body.published_at || (allowedStatus(body, req) === 'published' ? new Date() : null)
    })
  },
  categories: {
    model: models.Category,
    title: 'Categories',
    permission: 'manage_categories',
    searchFields: ['name', 'slug'],
    formData: async () => ({ categories: await models.Category.findAll() }),
    payload: async (body, req, record = null, transaction = null) => ({
      name: sanitizePlainText(body.name, 120),
      slug: await createUniqueSlug(models.Category, body.slug || body.name, 'category', record?.id),
      description: sanitizePlainText(body.description, 1000),
      parent_id: body.parent_id || null,
      image: await resolveImageValue(req, { fileField: 'image_file', pathField: 'image', record, transaction })
    })
  },
  tags: {
    model: models.Tag,
    title: 'Tags',
    permission: 'manage_tags',
    searchFields: ['name', 'slug'],
    payload: async (body, req, record = null) => ({ name: sanitizePlainText(body.name, 120), slug: await createUniqueSlug(models.Tag, body.slug || body.name, 'tag', record?.id), description: sanitizePlainText(body.description, 1000) })
  },
  banners: {
    model: models.Banner,
    title: 'Banners',
    permission: 'manage_banners',
    searchFields: ['title', 'subtitle'],
    payload: async (body, req, record = null, transaction = null) => ({
      title: sanitizePlainText(body.title, 180),
      subtitle: sanitizePlainText(body.subtitle, 500),
      image: await resolveImageValue(req, { fileField: 'image_file', pathField: 'image', record, transaction }),
      button_text: sanitizePlainText(body.button_text, 80),
      button_link: sanitizePlainText(body.button_link, 255),
      display_order: body.display_order || 0,
      active: body.active === 'on'
    })
  },
  sliders: {
    model: models.Slider,
    title: 'Sliders',
    permission: 'manage_sliders',
    searchFields: ['title', 'description'],
    payload: async (body, req, record = null, transaction = null) => {
      const images = await resolveSliderImages(req, record, transaction);
      return {
        title: sanitizePlainText(body.title, 180),
        description: sanitizePlainText(body.description, 500),
        images: images.length ? images : null,
        image: images[0] || null,
        button_text: sanitizePlainText(body.button_text, 80),
        button_url: sanitizePlainText(body.button_url, 255),
        display_order: body.display_order || 0,
        active: body.active === 'on'
      };
    }
  },
  menus: {
    model: models.Menu,
    title: 'Menus',
    permission: 'manage_menus',
    searchFields: ['name', 'slug'],
    include: [{ model: models.MenuItem, as: 'items', separate: true, order: [['display_order', 'ASC'], ['title', 'ASC']] }],
    formData: async () => ({ menus: await models.Menu.findAll({ order: [['name', 'ASC']] }) }),
    payload: async (body, req, record = null) => ({ name: sanitizePlainText(body.name, 120), slug: await createUniqueSlug(models.Menu, body.slug || body.name, 'menu', record?.id), location: body.location || 'header', active: body.active === 'on' })
  },
  'menu-items': {
    model: models.MenuItem,
    title: 'Menu Items',
    permission: 'manage_menus',
    searchFields: ['title', 'url'],
    include: [{ model: models.Menu }],
    formData: async () => ({ menus: await models.Menu.findAll({ order: [['name', 'ASC']] }), menuItems: await models.MenuItem.findAll({ order: [['title', 'ASC']] }) }),
    payload: (body) => ({ menu_id: body.menu_id, parent_id: body.parent_id || null, title: sanitizePlainText(body.title, 120), url: sanitizePlainText(body.url, 255), item_type: body.item_type || 'custom', reference_id: body.reference_id || null, target: body.target || '_self', display_order: body.display_order || 0, active: body.active === 'on' })
  },
  users: {
    model: models.User,
    title: 'Users',
    permission: 'manage_users',
    searchFields: ['name', 'email'],
    include: [models.Role],
    formData: async () => ({ roles: await models.Role.findAll() }),
    payload: async (body) => {
      const payload = { name: sanitizePlainText(body.name, 120), email: sanitizePlainText(body.email, 180), role_id: body.role_id || null, status: body.status || 'active' };
      if (body.password) payload.password = await bcrypt.hash(body.password, 12);
      return payload;
    }
  },
  roles: {
    model: models.Role,
    title: 'Roles',
    permission: 'manage_roles',
    searchFields: ['name', 'slug'],
    include: [models.Permission],
    formData: async () => ({ permissions: await models.Permission.findAll() }),
    payload: async (body, req, record = null) => ({ name: sanitizePlainText(body.name, 120), slug: await createUniqueSlug(models.Role, body.slug || body.name, 'role', record?.id), description: sanitizePlainText(body.description, 1000) }),
    afterSave: async (record, body, transaction = null) => record.setPermissions(normalizeArray(body.permissions), { transaction })
  },
  comments: {
    model: models.Comment,
    title: 'Comments',
    permission: 'manage_comments',
    searchFields: ['name', 'email', 'content'],
    include: [models.Post],
    payload: (body) => ({ status: body.status || 'pending', content: sanitizePlainText(body.content, 3000) })
  },
  messages: {
    model: models.ContactMessage,
    title: 'Contact Messages',
    permission: 'manage_settings',
    searchFields: ['name', 'email', 'subject'],
    payload: (body) => ({ status: body.status || 'unread' })
  }
};

function getConfig(resource) {
  const config = configs[resource];
  if (!config) {
    const error = new Error('Unknown admin resource.');
    error.status = 404;
    throw error;
  }
  return config;
}

async function index(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    if (!policy.canManageResource(req.session.user, resource, 'index')) {
      req.flash('error', 'You do not have permission to access that resource.');
      return res.redirect('/admin/profile');
    }
    const { page, limit, offset } = getPagination(req, 10);
    const query = req.query.q || '';
    const trashed = req.query.trashed === '1';
    const where = query
      ? { [Op.or]: config.searchFields.map((field) => ({ [field]: { [Op.like]: `%${query}%` } })) }
      : {};
    if (trashed) {
      where.deleted_at = { [Op.ne]: null };
    }
    if (resource === 'posts') {
      where.post_type = 'post';
      if (req.query.status) where.status = req.query.status;
      if (req.query.category_id) where.category_id = req.query.category_id;
      if (!policy.can(req.session.user, 'manage_posts')) where.author_id = req.session.user.id;
    }
    if (resource === 'pages' && req.query.status) {
      where.status = req.query.status;
    }
    if (resource === 'menu-items' && req.query.menu_id) {
      where.menu_id = req.query.menu_id;
    }
    const order = resource === 'menu-items'
      ? [['display_order', 'ASC'], ['title', 'ASC']]
      : resource === 'menus'
        ? [['name', 'ASC']]
        : [['created_at', 'DESC']];
    const { rows, count } = await config.model.findAndCountAll({
      where,
      include: config.include || [],
      distinct: true,
      limit,
      offset,
      order,
      paranoid: !trashed
    });
    return res.render('admin/crud/index', {
      title: trashed ? `${config.title} Trash` : config.title,
      resource,
      config,
      rows,
      query,
      trashed,
      pagination: pageMeta(count, page, limit),
      filters: {
        status: req.query.status || '',
        category_id: req.query.category_id || '',
        menu_id: req.query.menu_id || ''
      },
      extra: config.formData ? await config.formData() : {}
    });
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    if (!policy.canManageResource(req.session.user, resource, 'create')) {
      req.flash('error', 'You do not have permission to create that resource.');
      return res.redirect(`/admin/${resource}`);
    }
    const defaults = {};
    if (resource === 'menu-items' && req.query.menu_id) {
      defaults.menu_id = req.query.menu_id;
    }
    return res.render('admin/crud/form', {
      title: `Add ${config.title}`,
      resource,
      config,
      record: defaults,
      extra: config.formData ? await config.formData() : {},
      translations: {},
      translationLocales: TRANSLATION_LOCALES
    });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    if (!policy.canManageResource(req.session.user, resource, 'store')) {
      req.flash('error', 'You do not have permission to create that resource.');
      return res.redirect(`/admin/${resource}`);
    }
    await models.sequelize.transaction(async (transaction) => {
      let payload = await config.payload(req.body, req, null, transaction);
      if (resource === 'users') await ensureUserMutationAllowed(req, payload);
      if (resource === 'posts') {
        const filtered = await pluginLoader.applyFilters('beforePostSave', payload, { req, record: null, transaction });
        if (filtered === false || filtered === null) {
          const error = new Error('Post save blocked by a plugin.');
          error.status = 400;
          throw error;
        }
        payload = filtered || payload;
      }
      const record = await config.model.create(payload, { transaction });
      if (config.afterSave) await config.afterSave(record, req.body, transaction);
      if (resource === 'posts') {
        await saveTranslations('post', record.id, req.body, transaction);
        await pluginLoader.doAction('afterPostSave', record, { req, transaction, isNew: true });
      }
      if (resource === 'pages') {
        await saveTranslations('page', record.id, req.body, transaction);
      }
    });
    req.flash('success', `${config.title} saved.`);
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const record = await config.model.findByPk(req.params.id, { include: config.include || [] });
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    if (!policy.canManageResource(req.session.user, resource, 'edit', record)) {
      req.flash('error', 'You do not have permission to edit that resource.');
      return res.redirect(`/admin/${resource}`);
    }
    const translations = (resource === 'posts' || resource === 'pages')
      ? await loadTranslations(resource === 'pages' ? 'page' : 'post', record.id)
      : {};
    const previewUrl = (resource === 'posts' || resource === 'pages') && record.slug
      ? buildPreviewUrl(resource === 'pages' ? 'page' : 'post', record.slug, record.id)
      : '';
    return res.render('admin/crud/form', {
      title: `Edit ${config.title}`,
      resource,
      config,
      record,
      extra: config.formData ? await config.formData() : {},
      translations,
      translationLocales: TRANSLATION_LOCALES,
      previewUrl
    });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const record = await config.model.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    if (!policy.canManageResource(req.session.user, resource, 'update', record)) {
      req.flash('error', 'You do not have permission to update that resource.');
      return res.redirect(`/admin/${resource}`);
    }
    await models.sequelize.transaction(async (transaction) => {
      let payload = await config.payload(req.body, req, record, transaction);
      if (resource === 'users') {
        await ensureNotLastSuperAdmin(record);
        await ensureUserMutationAllowed(req, payload, record);
      }
      if (resource === 'posts') {
        const filtered = await pluginLoader.applyFilters('beforePostSave', payload, { req, record, transaction });
        if (filtered === false || filtered === null) {
          const error = new Error('Post save blocked by a plugin.');
          error.status = 400;
          throw error;
        }
        payload = filtered || payload;
      }
      if (resource === 'posts' || resource === 'pages') {
        await saveContentRevision(resource, record, req.session.user.id, transaction);
      }
      await record.update(payload, { transaction });
      if (config.afterSave) await config.afterSave(record, req.body, transaction);
      if (resource === 'posts') {
        await saveTranslations('post', record.id, req.body, transaction);
        await pluginLoader.doAction('afterPostSave', record, { req, transaction, isNew: false });
      }
      if (resource === 'pages') {
        await saveTranslations('page', record.id, req.body, transaction);
      }
    });
    req.flash('success', `${config.title} updated.`);
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

async function restore(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const record = await config.model.findByPk(req.params.id, { paranoid: false });
    if (!record || !record.deleted_at) {
      req.flash('error', 'Item not found in trash.');
      return res.redirect(`/admin/${resource}?trashed=1`);
    }
    if (!policy.canManageResource(req.session.user, resource, 'destroy', record)) {
      req.flash('error', 'You do not have permission to restore that resource.');
      return res.redirect(`/admin/${resource}?trashed=1`);
    }
    await record.restore();
    req.flash('success', `${config.title} restored from trash.`);
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

async function forceDestroy(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const record = await config.model.findByPk(req.params.id, { paranoid: false });
    if (!record) {
      req.flash('error', 'Item not found.');
      return res.redirect(`/admin/${resource}?trashed=1`);
    }
    if (!policy.canManageResource(req.session.user, resource, 'destroy', record)) {
      req.flash('error', 'You do not have permission to delete that resource.');
      return res.redirect(`/admin/${resource}?trashed=1`);
    }
    await record.destroy({ force: true });
    req.flash('success', `${config.title} permanently deleted.`);
    return res.redirect(`/admin/${resource}?trashed=1`);
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const record = await config.model.findByPk(req.params.id);
    if (record && !policy.canManageResource(req.session.user, resource, 'destroy', record)) {
      req.flash('error', 'You do not have permission to delete that resource.');
      return res.redirect(`/admin/${resource}`);
    }
    if (resource === 'users') {
      if (Number(record.id) === Number(req.session.user.id)) {
        req.flash('error', 'You cannot delete your own account.');
        return res.redirect(`/admin/${resource}`);
      }
      await ensureNotLastSuperAdmin(record);
    }
    if (record) await record.destroy();
    req.flash('success', `${config.title} moved to trash.`);
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

function normalizeBulkIds(body) {
  if (!body.ids) return [];
  return Array.isArray(body.ids) ? body.ids : [body.ids];
}

async function bulkDestroy(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const action = req.body.action || 'trash';
    if (action === 'restore') {
      const ids = normalizeBulkIds(req.body).map((id) => Number(id)).filter(Boolean);
      let restored = 0;
      for (const id of ids) {
        const record = await config.model.findByPk(id, { paranoid: false });
        if (!record?.deleted_at) continue;
        if (!policy.canManageResource(req.session.user, resource, 'bulk', record)) continue;
        await record.restore();
        restored += 1;
      }
      req.flash('success', restored ? `${restored} item(s) restored.` : 'No items restored.');
      return res.redirect(`/admin/${resource}${req.body.return_trashed ? '?trashed=1' : ''}`);
    }
    if (action !== 'trash') {
      req.flash('error', 'Unsupported bulk action.');
      return res.redirect(`/admin/${resource}`);
    }

    const ids = normalizeBulkIds(req.body).map((id) => Number(id)).filter(Boolean);
    if (!ids.length) {
      req.flash('error', 'No items selected.');
      return res.redirect(`/admin/${resource}`);
    }

    const records = await config.model.findAll({ where: { id: ids } });
    let removed = 0;
    for (const record of records) {
      if (!policy.canManageResource(req.session.user, resource, 'bulk', record)) continue;
      if (resource === 'users') {
        if (Number(record.id) === Number(req.session.user.id)) continue;
        try {
          await ensureNotLastSuperAdmin(record);
        } catch (error) {
          continue;
        }
      }
      await record.destroy();
      removed += 1;
    }

    req.flash('success', removed ? `${removed} item(s) moved to trash.` : 'No items could be trashed with your permissions.');
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { configs, index, create, store, edit, update, destroy, restore, forceDestroy, bulkDestroy };
