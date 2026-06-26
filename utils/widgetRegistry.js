const WIDGET_DEFINITIONS = {
  search: {
    label: 'Search',
    description: 'A search box for visitors.',
    icon: 'bi-search',
    group: 'core',
    defaultTitle: 'Search',
    fields: [
      { name: 'title', type: 'text', label: 'Title', default: 'Search' }
    ]
  },
  recent_posts: {
    label: 'Recent Posts',
    description: 'List of your latest published posts.',
    icon: 'bi-clock-history',
    group: 'core',
    defaultTitle: 'Recent Posts',
    fields: [
      { name: 'title', type: 'text', label: 'Title', default: 'Recent Posts' },
      { name: 'limit', type: 'number', label: 'Number of posts to show', default: 5, min: 1, max: 20 },
      { name: 'show_date', type: 'checkbox', label: 'Display post date', default: true }
    ]
  },
  categories: {
    label: 'Categories',
    description: 'List or dropdown of post categories.',
    icon: 'bi-folder',
    group: 'core',
    defaultTitle: 'Categories',
    fields: [
      { name: 'title', type: 'text', label: 'Title', default: 'Categories' },
      { name: 'dropdown', type: 'checkbox', label: 'Display as dropdown', default: false }
    ]
  },
  tags: {
    label: 'Tag Cloud',
    description: 'Your most used tags.',
    icon: 'bi-tags',
    group: 'core',
    defaultTitle: 'Tags',
    fields: [
      { name: 'title', type: 'text', label: 'Title', default: 'Tags' }
    ]
  },
  navigation_menu: {
    label: 'Navigation Menu',
    description: 'Show a custom menu from Appearance → Menus.',
    icon: 'bi-list-ul',
    group: 'core',
    defaultTitle: 'Links',
    fields: [
      { name: 'title', type: 'text', label: 'Title', default: 'Links' },
      { name: 'menu_slug', type: 'menu', label: 'Menu', default: 'header' }
    ]
  },
  custom_html: {
    label: 'Custom HTML',
    description: 'Arbitrary HTML (sanitized).',
    icon: 'bi-code-slash',
    group: 'core',
    defaultTitle: '',
    fields: [
      { name: 'title', type: 'text', label: 'Title (optional)' },
      { name: 'content', type: 'textarea', label: 'HTML content', rows: 6 }
    ]
  },
  text: {
    label: 'Text',
    description: 'Plain text or basic HTML block.',
    icon: 'bi-text-paragraph',
    group: 'core',
    defaultTitle: '',
    fields: [
      { name: 'title', type: 'text', label: 'Title (optional)' },
      { name: 'content', type: 'textarea', label: 'Content', rows: 5 }
    ]
  },
  image: {
    label: 'Image',
    description: 'Display an image from a URL.',
    icon: 'bi-image',
    group: 'core',
    defaultTitle: '',
    fields: [
      { name: 'title', type: 'text', label: 'Title (optional)' },
      { name: 'url', type: 'url', label: 'Image URL' },
      { name: 'alt', type: 'text', label: 'Alt text' },
      { name: 'link', type: 'url', label: 'Link URL (optional)' }
    ]
  },
  subscribe: {
    label: 'Subscribe',
    description: 'Newsletter signup call-to-action text.',
    icon: 'bi-envelope',
    group: 'core',
    defaultTitle: 'Subscribe',
    fields: [
      { name: 'title', type: 'text', label: 'Title', default: 'Subscribe' },
      { name: 'text', type: 'textarea', label: 'Message', rows: 3, default: 'Subscribe to receive updates.' }
    ]
  }
};

const WIDGET_TYPES = Object.keys(WIDGET_DEFINITIONS);

const DEFAULT_WIDGET_AREAS = [
  { name: 'Sidebar', slug: 'sidebar', description: 'Main sidebar widget area', display_order: 1 },
  { name: 'Footer Column 1', slug: 'footer-1', description: 'Footer first column', display_order: 2 },
  { name: 'Footer Column 2', slug: 'footer-2', description: 'Footer second column', display_order: 3 },
  { name: 'Footer Column 3', slug: 'footer-3', description: 'Footer third column', display_order: 4 },
  { name: 'Homepage Sections', slug: 'homepage-sections', description: 'Homepage widget sections', display_order: 5 }
];

async function ensureDefaultWidgetAreas(models) {
  for (const row of DEFAULT_WIDGET_AREAS) {
    await models.WidgetArea.findOrCreate({
      where: { slug: row.slug },
      defaults: { ...row, status: 'active' }
    });
  }
}

function getWidgetDefinition(type) {
  return WIDGET_DEFINITIONS[type] || WIDGET_DEFINITIONS.text;
}

function parseCheckbox(value) {
  return value === 'on' || value === true || value === 'true' || value === 1 || value === '1';
}

function buildWidgetFromForm(body, type) {
  const safeType = WIDGET_TYPES.includes(type) ? type : 'text';
  const def = getWidgetDefinition(safeType);
  const title = String(body.title || '').trim() || def.defaultTitle || '';
  const settings = {};

  for (const field of def.fields) {
    if (field.name === 'title') continue;
    if (field.type === 'number') {
      const raw = Number(body[field.name]);
      const min = field.min ?? 1;
      const max = field.max ?? 100;
      settings[field.name] = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : field.default;
    } else if (field.type === 'checkbox') {
      settings[field.name] = parseCheckbox(body[field.name]);
    } else {
      settings[field.name] = String(body[field.name] ?? field.default ?? '').trim();
    }
  }

  return {
    widget_type: safeType,
    title,
    settings_json: JSON.stringify(settings),
    display_order: Number(body.display_order) || 0,
    status: body.status === 'inactive' ? 'inactive' : 'active'
  };
}

function settingsToFormValues(widget) {
  let settings = {};
  try {
    settings = typeof widget.settings_json === 'string' ? JSON.parse(widget.settings_json) : widget.settings_json || {};
  } catch {
    settings = {};
  }
  return {
    title: widget.title || '',
    status: widget.status || 'active',
    ...settings,
    show_date: settings.show_date !== false,
    dropdown: Boolean(settings.dropdown)
  };
}

async function seedDefaultSidebarWidgets(models) {
  const area = await models.WidgetArea.findOne({ where: { slug: 'sidebar' } });
  if (!area) return { seeded: false, reason: 'no_area' };
  const count = await models.WidgetInstance.count({ where: { widget_area_id: area.id } });
  if (count > 0) return { seeded: false, reason: 'already_has_widgets' };

  const defaults = [
    { widget_type: 'search', title: 'Search', settings_json: '{}', display_order: 1 },
    { widget_type: 'categories', title: 'Categories', settings_json: '{}', display_order: 2 },
    { widget_type: 'recent_posts', title: 'Recent Posts', settings_json: JSON.stringify({ limit: 5, show_date: true }), display_order: 3 }
  ];

  for (const row of defaults) {
    await models.WidgetInstance.create({ ...row, widget_area_id: area.id, status: 'active' });
  }
  return { seeded: true, count: defaults.length };
}

module.exports = {
  WIDGET_DEFINITIONS,
  WIDGET_TYPES,
  DEFAULT_WIDGET_AREAS,
  getWidgetDefinition,
  buildWidgetFromForm,
  settingsToFormValues,
  ensureDefaultWidgetAreas,
  seedDefaultSidebarWidgets
};
