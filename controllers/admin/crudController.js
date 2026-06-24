const bcrypt = require('bcrypt');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const { Op } = require('sequelize');
const models = require('../../models');
const { classifyMime, publicUploadPath } = require('../../utils/fileHelper');
const { createSlug } = require('../../utils/slugGenerator');
const { getPagination, pageMeta } = require('../../utils/pagination');

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

async function createMediaFromUpload(file, userId) {
  if (!file) return null;

  const relative = `/uploads/${path.relative(publicUploadPath(), file.path).replace(/\\/g, '/')}`;
  await models.Media.create({
    filename: file.filename,
    original_name: file.originalname,
    file_path: relative,
    file_type: classifyMime(file.mimetype),
    mime_type: file.mimetype,
    file_size: file.size,
    uploaded_by: userId
  });
  return relative;
}

const configs = {
  posts: {
    model: models.Post,
    title: 'Posts',
    permission: 'manage_posts',
    searchFields: ['title', 'slug', 'excerpt'],
    include: [{ model: models.Category }, { model: models.User, as: 'author' }, models.Tag],
    formData: async () => ({ categories: await models.Category.findAll(), tags: await models.Tag.findAll(), users: await models.User.findAll() }),
    payload: async (body, req) => {
      const uploadedFeaturedImage = await createMediaFromUpload(req.file, req.session.user.id);
      return {
        title: body.title,
        slug: createSlug(body.slug || body.title, 'post'),
        content: sanitizeHtml(body.content || '', richTextSanitizeOptions),
        excerpt: body.excerpt,
        featured_image: uploadedFeaturedImage || body.featured_image,
        video_url: body.video_url,
        status: body.status || 'draft',
        category_id: body.category_id || null,
        author_id: body.author_id || req.session.user.id,
        seo_title: body.seo_title,
        seo_description: body.seo_description,
        og_image: body.og_image,
        allow_comments: body.allow_comments === 'on',
        published_at: body.published_at || (body.status === 'published' ? new Date() : null)
      };
    },
    afterSave: async (record, body) => record.setTags(body.tags || [])
  },
  pages: {
    model: models.Page,
    title: 'Pages',
    permission: 'manage_pages',
    searchFields: ['title', 'slug', 'excerpt'],
    payload: (body, req) => ({
      title: body.title,
      slug: createSlug(body.slug || body.title, 'page'),
      content: sanitizeHtml(body.content || '', richTextSanitizeOptions),
      excerpt: body.excerpt,
      status: body.status || 'draft',
      seo_title: body.seo_title,
      seo_description: body.seo_description,
      author_id: req.session.user.id,
      published_at: body.published_at || (body.status === 'published' ? new Date() : null)
    })
  },
  categories: {
    model: models.Category,
    title: 'Categories',
    permission: 'manage_categories',
    searchFields: ['name', 'slug'],
    formData: async () => ({ categories: await models.Category.findAll() }),
    payload: (body) => ({ name: body.name, slug: createSlug(body.slug || body.name, 'category'), description: body.description, parent_id: body.parent_id || null, image: body.image })
  },
  tags: {
    model: models.Tag,
    title: 'Tags',
    permission: 'manage_tags',
    searchFields: ['name', 'slug'],
    payload: (body) => ({ name: body.name, slug: createSlug(body.slug || body.name, 'tag'), description: body.description })
  },
  banners: {
    model: models.Banner,
    title: 'Banners',
    permission: 'manage_banners',
    searchFields: ['title', 'subtitle'],
    payload: (body) => ({ title: body.title, subtitle: body.subtitle, image: body.image, button_text: body.button_text, button_link: body.button_link, display_order: body.display_order || 0, active: body.active === 'on' })
  },
  sliders: {
    model: models.Slider,
    title: 'Sliders',
    permission: 'manage_sliders',
    searchFields: ['title', 'description'],
    payload: (body) => ({ title: body.title, description: body.description, image: body.image, button_text: body.button_text, button_url: body.button_url, display_order: body.display_order || 0, active: body.active === 'on' })
  },
  menus: {
    model: models.Menu,
    title: 'Menus',
    permission: 'manage_menus',
    searchFields: ['name', 'slug'],
    include: [{ model: models.MenuItem, as: 'items' }],
    payload: (body) => ({ name: body.name, slug: createSlug(body.slug || body.name, 'menu'), location: body.location || 'header', active: body.active === 'on' })
  },
  'menu-items': {
    model: models.MenuItem,
    title: 'Menu Items',
    permission: 'manage_menus',
    searchFields: ['title', 'url'],
    formData: async () => ({ menus: await models.Menu.findAll(), menuItems: await models.MenuItem.findAll() }),
    payload: (body) => ({ menu_id: body.menu_id, parent_id: body.parent_id || null, title: body.title, url: body.url, item_type: body.item_type || 'custom', reference_id: body.reference_id || null, target: body.target || '_self', display_order: body.display_order || 0, active: body.active === 'on' })
  },
  users: {
    model: models.User,
    title: 'Users',
    permission: 'manage_users',
    searchFields: ['name', 'email'],
    include: [models.Role],
    formData: async () => ({ roles: await models.Role.findAll() }),
    payload: async (body) => {
      const payload = { name: body.name, email: body.email, role_id: body.role_id || null, status: body.status || 'active' };
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
    payload: (body) => ({ name: body.name, slug: createSlug(body.slug || body.name, 'role'), description: body.description }),
    afterSave: async (record, body) => record.setPermissions(body.permissions || [])
  },
  comments: {
    model: models.Comment,
    title: 'Comments',
    permission: 'manage_comments',
    searchFields: ['name', 'email', 'content'],
    include: [models.Post],
    payload: (body) => ({ status: body.status || 'pending', content: body.content })
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
    const { page, limit, offset } = getPagination(req, 10);
    const query = req.query.q || '';
    const where = query
      ? { [Op.or]: config.searchFields.map((field) => ({ [field]: { [Op.like]: `%${query}%` } })) }
      : {};
    const { rows, count } = await config.model.findAndCountAll({
      where,
      include: config.include || [],
      distinct: true,
      limit,
      offset,
      order: [['created_at', 'DESC']]
    });
    return res.render('admin/crud/index', {
      title: config.title,
      resource,
      config,
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
    const resource = req.params.resource;
    const config = getConfig(resource);
    return res.render('admin/crud/form', {
      title: `Add ${config.title}`,
      resource,
      config,
      record: {},
      extra: config.formData ? await config.formData() : {}
    });
  } catch (error) {
    return next(error);
  }
}

async function store(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const payload = await config.payload(req.body, req);
    const record = await config.model.create(payload);
    if (config.afterSave) await config.afterSave(record, req.body);
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
    return res.render('admin/crud/form', {
      title: `Edit ${config.title}`,
      resource,
      config,
      record,
      extra: config.formData ? await config.formData() : {}
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
    await record.update(await config.payload(req.body, req));
    if (config.afterSave) await config.afterSave(record, req.body);
    req.flash('success', `${config.title} updated.`);
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    const resource = req.params.resource;
    const config = getConfig(resource);
    const record = await config.model.findByPk(req.params.id);
    if (record) await record.destroy();
    req.flash('success', `${config.title} deleted.`);
    return res.redirect(`/admin/${resource}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { configs, index, create, store, edit, update, destroy };
