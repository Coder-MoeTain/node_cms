const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const models = require('../models');
const { parseShortcodes } = require('./shortcodeParser');
const { renderBlocks } = require('./blockRenderer');

const WIDGET_TYPES = [
  'search', 'recent_posts', 'categories', 'tags', 'navigation_menu', 'custom_html',
  'text', 'image', 'video', 'portal_quick_services', 'emergency_contacts', 'hot_news', 'subscribe'
];

function parseSettings(json) {
  if (!json) return {};
  try {
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return {};
  }
}

async function renderWidget(instance, context = {}) {
  const settings = parseSettings(instance.settings_json);
  const title = instance.title ? `<h3 class="widget-title">${sanitizeHtml(instance.title, { allowedTags: [], allowedAttributes: {} })}</h3>` : '';

  switch (instance.widget_type) {
    case 'search':
      return `${title}<form class="widget-search" action="/search" method="get"><input type="search" name="q" class="form-control" placeholder="Search…"><button type="submit" class="btn btn-primary btn-sm mt-2">Search</button></form>`;
    case 'recent_posts': {
      const limit = Number(settings.limit) || 5;
      const posts = await models.Post.findAll({
        where: { status: 'published', post_type: 'post' },
        limit,
        order: [['published_at', 'DESC']],
        attributes: ['title', 'slug']
      });
      const items = posts.map((p) => `<li><a href="/post/${p.slug}">${sanitizeHtml(p.title, { allowedTags: [], allowedAttributes: {} })}</a></li>`).join('');
      return `${title}<ul class="widget-recent-posts">${items}</ul>`;
    }
    case 'categories': {
      const cats = await models.Category.findAll({ limit: 20, order: [['name', 'ASC']] });
      const items = cats.map((c) => `<li><a href="/category/${c.slug}">${sanitizeHtml(c.name, { allowedTags: [], allowedAttributes: {} })}</a></li>`).join('');
      return `${title}<ul class="widget-categories">${items}</ul>`;
    }
    case 'tags': {
      const tags = await models.Tag.findAll({ limit: 30, order: [['name', 'ASC']] });
      const items = tags.map((t) => `<a class="badge bg-secondary me-1 mb-1" href="/tag/${t.slug}">${sanitizeHtml(t.name, { allowedTags: [], allowedAttributes: {} })}</a>`).join('');
      return `${title}<div class="widget-tags">${items}</div>`;
    }
    case 'custom_html':
    case 'text':
      return `${title}<div class="widget-text">${sanitizeHtml(settings.content || '', { allowedTags: sanitizeHtml.defaults.allowedTags, allowedAttributes: sanitizeHtml.defaults.allowedAttributes })}</div>`;
    case 'image':
      return settings.url ? `${title}<img src="${sanitizeHtml(settings.url, { allowedTags: [], allowedAttributes: {} })}" alt="${sanitizeHtml(settings.alt || '', { allowedTags: [], allowedAttributes: {} })}" class="img-fluid">` : '';
    case 'subscribe':
      return `${title}<p class="widget-subscribe">${sanitizeHtml(settings.text || 'Subscribe to updates.', { allowedTags: [], allowedAttributes: {} })}</p>`;
    default:
      return `${title}<div class="widget widget-${instance.widget_type}"></div>`;
  }
}

async function renderWidgetArea(slug, context = {}) {
  const area = await models.WidgetArea.findOne({
    where: { slug, status: 'active' },
    include: [{
      model: models.WidgetInstance,
      as: 'widgets',
      where: { status: 'active' },
      required: false
    }]
  });
  if (!area) return '';
  const widgets = (area.widgets || []).sort((a, b) => a.display_order - b.display_order);
  const html = [];
  for (const widget of widgets) {
    html.push(`<div class="widget widget-type-${widget.widget_type}">${await renderWidget(widget, context)}</div>`);
  }
  return html.join('\n');
}

async function loadAllWidgetAreas(context = {}) {
  const areas = await models.WidgetArea.findAll({
    where: { status: 'active' },
    include: [{ model: models.WidgetInstance, as: 'widgets', where: { status: 'active' }, required: false }],
    order: [['display_order', 'ASC']]
  });
  const map = {};
  for (const area of areas) {
    map[area.slug] = await renderWidgetArea(area.slug, context);
  }
  return map;
}

module.exports = { WIDGET_TYPES, renderWidget, renderWidgetArea, loadAllWidgetAreas, parseSettings };
