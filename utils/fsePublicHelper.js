const { SiteTemplate } = require('../models');
const { renderBlocks } = require('./blockRenderer');

const TYPE_MAP = {
  home: 'homepage',
  'front-page': 'homepage',
  post: 'single-post',
  page: 'page',
  blog: 'blog',
  archive: 'archive',
  search: 'search',
  contact: 'contact',
  category: 'archive',
  tag: 'archive',
  error: '404',
  '404': '404'
};

async function loadFseTemplateHtml(templateName, themeSlug, context = {}) {
  const mapped = TYPE_MAP[templateName] || templateName;
  const where = { template_type: mapped, status: 'active' };
  if (themeSlug) where.theme_slug = themeSlug;
  const row = await SiteTemplate.findOne({ where, order: [['updated_at', 'DESC']] });
  if (!row?.block_content_json) return null;
  const html = renderBlocks(row.block_content_json, context);
  if (!html?.trim()) return null;
  return { html, template: row };
}

async function attachFseLocals(templateName, locals, themeSlug, context = {}) {
  const fse = await loadFseTemplateHtml(templateName, themeSlug, context);
  if (!fse) return locals;
  return {
    ...locals,
    fseTemplateHtml: fse.html,
    fseTemplate: { slug: fse.template.slug, name: fse.template.name, type: fse.template.template_type }
  };
}

module.exports = { loadFseTemplateHtml, attachFseLocals, TYPE_MAP };
