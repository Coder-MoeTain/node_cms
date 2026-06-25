const sanitizeHtml = require('sanitize-html');
const models = require('../../models');
const policy = require('../../utils/policy');
const { validateBlockSchema } = require('../../utils/blockRenderer');

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const templates = await models.SiteTemplate.findAll({ order: [['template_type', 'ASC'], ['name', 'ASC']] });
    const parts = await models.TemplatePart.findAll({ order: [['part_type', 'ASC'], ['name', 'ASC']] });
    return res.render('admin/templates/index', { title: 'Site Templates', templates, parts });
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/templates');
    }
    const record = await models.SiteTemplate.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    return res.render('admin/templates/edit', { title: `Edit Template — ${record.name}`, record });
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/templates');
    }
    const record = await models.SiteTemplate.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });
    const validation = validateBlockSchema(req.body.block_content_json || '[]');
    if (!validation.valid) {
      req.flash('error', validation.error);
      return res.redirect(`/admin/templates/${record.id}/edit`);
    }
    await record.update({
      name: sanitizeHtml(req.body.name || record.name, { allowedTags: [], allowedAttributes: {} }),
      block_content_json: JSON.stringify(validation.blocks),
      status: req.body.status === 'inactive' ? 'inactive' : 'active'
    });
    req.flash('success', 'Template saved.');
    return res.redirect('/admin/templates');
  } catch (error) {
    return next(error);
  }
}

async function createDefault(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/templates');
    }
    const types = ['header', 'footer', 'homepage', 'single-post', 'page', '404'];
    for (const templateType of types) {
      await models.SiteTemplate.findOrCreate({
        where: { slug: templateType, theme_slug: 'default' },
        defaults: {
          name: templateType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          template_type: templateType,
          theme_slug: 'default',
          block_content_json: JSON.stringify([{ type: 'paragraph', content: `${templateType} template` }]),
          status: 'active',
          created_by: req.session.user.id
        }
      });
    }
    req.flash('success', 'Default templates ensured.');
    return res.redirect('/admin/templates');
  } catch (error) {
    return next(error);
  }
}

module.exports = { index, edit, update, createDefault };
