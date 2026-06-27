const sanitizeHtml = require('sanitize-html');
const models = require('../models');
const { siteScopeWhere } = require('./siteScope');
const {
  WIDGET_TYPES,
  getWidgetDefinition
} = require('./widgetRegistry');
const { createDateFormatters } = require('./timezoneHelper');

function parseSettings(json) {
  if (!json) return {};
  try {
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return {};
  }
}

function esc(text) {
  return sanitizeHtml(String(text || ''), { allowedTags: [], allowedAttributes: {} });
}

function widgetTitleHtml(title) {
  if (!title) return '';
  return `<h2 class="widget-title portal-widget-title">${esc(title)}</h2>`;
}

async function renderNavigationMenu(menuSlug, req = null) {
  const menu = await models.Menu.findOne({
    where: siteScopeWhere(req, { slug: menuSlug }),
    include: [{ model: models.MenuItem, as: 'items' }]
  });
  if (!menu || !menu.items?.length) {
    return '<p class="widget-empty text-muted small mb-0">No menu items.</p>';
  }
  const items = menu.items
    .filter((item) => item.active !== false)
    .sort((a, b) => a.display_order - b.display_order);
  const links = items.map((item) => `<li><a href="${esc(item.url)}" target="${esc(item.target || '_self')}">${esc(item.title)}</a></li>`).join('');
  return `<ul class="widget-nav list-unstyled mb-0">${links}</ul>`;
}

async function renderWidget(instance, context = {}) {
  const settings = parseSettings(instance.settings_json);
  const title = widgetTitleHtml(instance.title);
  const formatDate = context.formatDate || createDateFormatters({ timeZone: context.siteTimezone }).formatDate;

  switch (instance.widget_type) {
    case 'search':
      return `${title}<div class="widget-body portal-widget-body"><form class="widget-search" action="/search" method="get" role="search"><label class="visually-hidden" for="widget-search-${instance.id}">Search</label><input id="widget-search-${instance.id}" type="search" name="q" class="form-control form-control-sm mb-2" placeholder="Search…"><button type="submit" class="site-btn portal-btn portal-btn-sm w-100">Search</button></form></div>`;
    case 'recent_posts': {
      const limit = Number(settings.limit) || 5;
      const posts = await models.Post.findAll({
        where: siteScopeWhere(context.req, { status: 'published', post_type: 'post' }),
        limit,
        order: [['published_at', 'DESC']],
        attributes: ['title', 'slug', 'published_at']
      });
      if (!posts.length) {
        return `${title}<div class="widget-body portal-widget-body"><p class="widget-empty text-muted small mb-0">No posts yet.</p></div>`;
      }
      const showDate = settings.show_date !== false;
      const items = posts.map((p) => {
        const date = showDate && p.published_at
          ? `<small class="text-muted d-block">${formatDate(p.published_at)}</small>`
          : '';
        return `<li class="mb-2 pb-2 border-bottom"><a href="/post/${p.slug}">${esc(p.title)}</a>${date}</li>`;
      }).join('');
      return `${title}<div class="widget-body portal-widget-body"><ul class="widget-recent-posts list-unstyled mb-0">${items}</ul></div>`;
    }
    case 'categories': {
      const cats = await models.Category.findAll({ limit: 50, order: [['name', 'ASC']] });
      if (!cats.length) {
        return `${title}<div class="widget-body portal-widget-body"><p class="widget-empty text-muted small mb-0">No categories yet.</p></div>`;
      }
      if (settings.dropdown) {
        const options = cats.map((c) => `<option value="/category/${c.slug}">${esc(c.name)}</option>`).join('');
        return `${title}<div class="widget-body portal-widget-body"><select class="form-select form-select-sm widget-categories-dropdown" onchange="if(this.value)window.location.href=this.value"><option value="">Select category</option>${options}</select></div>`;
      }
      const items = cats.map((c) => `<li class="mb-1"><a href="/category/${c.slug}">${esc(c.name)}</a></li>`).join('');
      return `${title}<div class="widget-body portal-widget-body"><ul class="widget-categories list-unstyled mb-0">${items}</ul></div>`;
    }
    case 'tags': {
      const tags = await models.Tag.findAll({ limit: 30, order: [['name', 'ASC']] });
      if (!tags.length) {
        return `${title}<div class="widget-body portal-widget-body"><p class="widget-empty text-muted small mb-0">No tags yet.</p></div>`;
      }
      const items = tags.map((t) => `<a class="badge bg-secondary me-1 mb-1" href="/tag/${t.slug}">${esc(t.name)}</a>`).join('');
      return `${title}<div class="widget-body portal-widget-body"><div class="widget-tags">${items}</div></div>`;
    }
    case 'navigation_menu':
      return `${title}<div class="widget-body portal-widget-body">${await renderNavigationMenu(settings.menu_slug || 'header', context.req)}</div>`;
    case 'custom_html':
    case 'text':
      return `${title}<div class="widget-body portal-widget-body widget-text">${sanitizeHtml(settings.content || '', { allowedTags: sanitizeHtml.defaults.allowedTags, allowedAttributes: sanitizeHtml.defaults.allowedAttributes })}</div>`;
    case 'image': {
      if (!settings.url) return '';
      const img = `<img src="${esc(settings.url)}" alt="${esc(settings.alt || '')}" class="img-fluid widget-image">`;
      const body = settings.link
        ? `<a href="${esc(settings.link)}" rel="noopener noreferrer">${img}</a>`
        : img;
      return `${title}<div class="widget-body portal-widget-body">${body}</div>`;
    }
    case 'subscribe':
      return `${title}<div class="widget-body portal-widget-body"><p class="widget-subscribe mb-2">${esc(settings.text || 'Subscribe to receive updates.')}</p><a class="site-btn portal-btn portal-btn-sm" href="/contact">Get in touch</a></div>`;
    default:
      return `${title}<div class="widget-body portal-widget-body"><div class="widget widget-${instance.widget_type}"></div></div>`;
  }
}

async function renderWidgetArea(slug, context = {}) {
  const req = context.req || null;
  const area = await models.WidgetArea.findOne({
    where: siteScopeWhere(req, { slug, status: 'active' }),
    include: [{
      model: models.WidgetInstance,
      as: 'widgets',
      where: { status: 'active' },
      required: false
    }]
  });
  if (!area) return '';
  const widgets = (area.widgets || []).sort((a, b) => a.display_order - b.display_order);
  if (!widgets.length) return '';

  const isPortal = Boolean(context.isPortal);
  const html = [];
  for (const widget of widgets) {
    const inner = await renderWidget(widget, context);
    if (!inner) continue;
    const shell = isPortal ? 'portal-widget portal-card-bordered' : 'widget';
    html.push(`<div class="${shell} widget-type-${widget.widget_type}">${inner}</div>`);
  }
  return html.join('\n');
}

async function loadAllWidgetAreas(context = {}) {
  try {
    const req = context.req || null;
    const areas = await models.WidgetArea.findAll({
      where: siteScopeWhere(req, { status: 'active' }),
      include: [{ model: models.WidgetInstance, as: 'widgets', where: { status: 'active' }, required: false }],
      order: [['display_order', 'ASC']]
    });
    const map = {};
    for (const area of areas) {
      map[area.slug] = await renderWidgetArea(area.slug, context);
    }
    return map;
  } catch {
    return {};
  }
}

module.exports = {
  WIDGET_TYPES,
  getWidgetDefinition,
  renderWidget,
  renderWidgetArea,
  loadAllWidgetAreas,
  parseSettings
};
