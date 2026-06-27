const sanitizeHtml = require('sanitize-html');
const models = require('../../models');
const policy = require('../../utils/policy');
const { validateBlockSchema, renderBlocks } = require('../../utils/blockRenderer');
const {
  DEFAULT_TEMPLATE_TYPES,
  DEFAULT_PART_TYPES,
  enrichTemplate,
  enrichPart,
  defaultBlockContent,
  titleCaseSlug,
  parseBlocks
} = require('../../utils/templateRegistry');

function deny(req, res, redirect = '/admin') {
  req.flash('error', 'You do not have permission.');
  return res.redirect(redirect);
}

async function loadActiveTheme() {
  return models.Theme.findOne({ where: { active: true } });
}

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res);

    const [templates, parts, activeTheme] = await Promise.all([
      models.SiteTemplate.findAll({ order: [['template_type', 'ASC'], ['name', 'ASC']] }),
      models.TemplatePart.findAll({ order: [['part_type', 'ASC'], ['name', 'ASC']] }),
      loadActiveTheme()
    ]);

    const enrichedTemplates = templates.map(enrichTemplate);
    const enrichedParts = parts.map(enrichPart);
    const stats = {
      templatesTotal: enrichedTemplates.length,
      templatesActive: enrichedTemplates.filter((t) => t.status === 'active').length,
      partsTotal: enrichedParts.length,
      partsActive: enrichedParts.filter((p) => p.status === 'active').length
    };

    return res.render('admin/templates/index', {
      title: 'Site Templates',
      templates: enrichedTemplates,
      parts: enrichedParts,
      stats,
      activeTheme,
      hasDefaults: enrichedTemplates.length > 0 || enrichedParts.length > 0
    });
  } catch (error) {
    return next(error);
  }
}

async function edit(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.SiteTemplate.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    const enriched = enrichTemplate(record);
    return res.render('admin/templates/edit', {
      title: `Edit Template — ${record.name}`,
      record: enriched,
      previewHtml: renderBlocks(record.block_content_json || '[]'),
      initialBlocks: parseBlocks(record.block_content_json)
    });
  } catch (error) {
    return next(error);
  }
}

async function editPart(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.TemplatePart.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    const enriched = enrichPart(record);
    return res.render('admin/templates/edit-part', {
      title: `Edit Template Part — ${record.name}`,
      record: enriched,
      previewHtml: renderBlocks(record.block_content_json || '[]'),
      initialBlocks: parseBlocks(record.block_content_json)
    });
  } catch (error) {
    return next(error);
  }
}

async function saveBlockRecord(req, record, redirectPath) {
  const validation = validateBlockSchema(req.body.block_content_json || '[]');
  if (!validation.valid) {
    req.flash('error', validation.error);
    return res.redirect(redirectPath);
  }

  await record.update({
    name: sanitizeHtml(req.body.name || record.name, { allowedTags: [], allowedAttributes: {} }),
    block_content_json: JSON.stringify(validation.blocks),
    status: req.body.status === 'inactive' ? 'inactive' : 'active'
  });

  req.flash('success', 'Saved successfully.');
  return res.redirect('/admin/templates');
}

async function update(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.SiteTemplate.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    return saveBlockRecord(req, record, `/admin/templates/${record.id}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function updatePart(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.TemplatePart.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    return saveBlockRecord(req, record, `/admin/templates/parts/${record.id}/edit`);
  } catch (error) {
    return next(error);
  }
}

async function createDefault(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const activeTheme = await loadActiveTheme();
    const themeSlug = activeTheme?.slug || 'default';

    for (const templateType of DEFAULT_TEMPLATE_TYPES) {
      const label = titleCaseSlug(templateType);
      await models.SiteTemplate.findOrCreate({
        where: { slug: templateType, theme_slug: themeSlug },
        defaults: {
          name: label,
          template_type: templateType,
          theme_slug: themeSlug,
          block_content_json: defaultBlockContent(label),
          status: 'active',
          created_by: req.session.user.id
        }
      });
    }

    for (const partType of DEFAULT_PART_TYPES) {
      const label = titleCaseSlug(partType);
      await models.TemplatePart.findOrCreate({
        where: { slug: partType, theme_slug: themeSlug },
        defaults: {
          name: label,
          part_type: partType,
          theme_slug: themeSlug,
          block_content_json: defaultBlockContent(label),
          status: 'active',
          created_by: req.session.user.id
        }
      });
    }

    req.flash('success', 'Default templates and template parts are ready.');
    return res.redirect('/admin/templates');
  } catch (error) {
    return next(error);
  }
}

async function duplicate(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.SiteTemplate.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    let suffix = 2;
    let newSlug = `${record.slug}-copy`;
    while (await models.SiteTemplate.findOne({ where: { slug: newSlug, theme_slug: record.theme_slug } })) {
      newSlug = `${record.slug}-copy-${suffix}`;
      suffix += 1;
    }

    await models.SiteTemplate.create({
      name: `${record.name} (Copy)`,
      slug: newSlug,
      template_type: record.template_type,
      theme_slug: record.theme_slug,
      block_content_json: record.block_content_json,
      status: 'inactive',
      created_by: req.session.user.id
    });

    req.flash('success', 'Template duplicated as inactive copy.');
    return res.redirect('/admin/templates');
  } catch (error) {
    return next(error);
  }
}

async function destroy(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.SiteTemplate.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    await record.destroy();
    req.flash('success', 'Template deleted.');
    return res.redirect('/admin/templates');
  } catch (error) {
    return next(error);
  }
}

async function destroyPart(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_themes')) return deny(req, res, '/admin/templates');

    const record = await models.TemplatePart.findByPk(req.params.id);
    if (!record) return res.status(404).render('errors/404', { title: 'Not Found' });

    await record.destroy();
    req.flash('success', 'Template part deleted.');
    return res.redirect('/admin/templates');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  edit,
  editPart,
  update,
  updatePart,
  createDefault,
  duplicate,
  destroy,
  destroyPart
};
