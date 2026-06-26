const models = require('../../models');
const policy = require('../../utils/policy');
const {
  WIDGET_DEFINITIONS,
  WIDGET_TYPES,
  getWidgetDefinition,
  buildWidgetFromForm,
  settingsToFormValues,
  ensureDefaultWidgetAreas,
  seedDefaultSidebarWidgets
} = require('../../utils/widgetRegistry');

function sortWidgets(area) {
  if (!area?.widgets) return [];
  return [...area.widgets].sort((a, b) => a.display_order - b.display_order || a.id - b.id);
}

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    await ensureDefaultWidgetAreas(models);
    const areas = await models.WidgetArea.findAll({
      include: [{ model: models.WidgetInstance, as: 'widgets' }],
      order: [['display_order', 'ASC']]
    });
    const sidebar = areas.find((area) => area.slug === 'sidebar');
    const sidebarEmpty = sidebar && !(sidebar.widgets || []).length;
    return res.render('admin/widgets/index', {
      title: 'Widgets',
      areas,
      widgetDefinitions: WIDGET_DEFINITIONS,
      sidebarEmpty
    });
  } catch (error) {
    return next(error);
  }
}

async function seedDefaults(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/widgets');
    }
    const result = await seedDefaultSidebarWidgets(models);
    if (result.seeded) {
      req.flash('success', `Added ${result.count} default sidebar widgets (Search, Categories, Recent Posts).`);
    } else if (result.reason === 'already_has_widgets') {
      req.flash('error', 'Sidebar already has widgets.');
    } else {
      req.flash('error', 'Sidebar widget area was not found.');
    }
    return res.redirect('/admin/widgets/sidebar');
  } catch (error) {
    return next(error);
  }
}

async function editArea(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/widgets');
    }
    const area = await models.WidgetArea.findOne({
      where: { slug: req.params.slug },
      include: [{ model: models.WidgetInstance, as: 'widgets' }]
    });
    if (!area) return res.status(404).render('errors/404', { title: 'Not Found' });

    const menus = await models.Menu.findAll({ order: [['name', 'ASC']] });
    area.widgets = sortWidgets(area);

    return res.render('admin/widgets/area', {
      title: `Widgets — ${area.name}`,
      area,
      menus,
      widgetDefinitions: WIDGET_DEFINITIONS,
      widgetTypes: WIDGET_TYPES,
      getWidgetDefinition,
      settingsToFormValues
    });
  } catch (error) {
    return next(error);
  }
}

async function addWidget(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/widgets');
    }
    const area = await models.WidgetArea.findOne({ where: { slug: req.params.slug } });
    if (!area) return res.status(404).render('errors/404', { title: 'Not Found' });

    const maxOrder = await models.WidgetInstance.max('display_order', { where: { widget_area_id: area.id } });
    const payload = buildWidgetFromForm(req.body, req.body.widget_type);
    await models.WidgetInstance.create({
      widget_area_id: area.id,
      widget_type: payload.widget_type,
      title: payload.title,
      settings_json: payload.settings_json,
      display_order: Number.isFinite(maxOrder) ? maxOrder + 1 : 1,
      status: payload.status
    });

    req.flash('success', `${getWidgetDefinition(payload.widget_type).label} widget added.`);
    return res.redirect(`/admin/widgets/${area.slug}`);
  } catch (error) {
    return next(error);
  }
}

async function updateWidget(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/widgets');
    }
    const widget = await models.WidgetInstance.findByPk(req.params.id, { include: [models.WidgetArea] });
    if (!widget) return res.status(404).render('errors/404', { title: 'Not Found' });

    const payload = buildWidgetFromForm(req.body, widget.widget_type);
    await widget.update({
      title: payload.title,
      settings_json: payload.settings_json,
      status: payload.status
    });

    req.flash('success', 'Widget updated.');
    return res.redirect(`/admin/widgets/${widget.WidgetArea.slug}`);
  } catch (error) {
    return next(error);
  }
}

async function reorderWidget(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const widget = await models.WidgetInstance.findByPk(req.params.id, { include: [models.WidgetArea] });
    if (!widget) return res.status(404).json({ error: 'Not found' });

    const siblings = await models.WidgetInstance.findAll({
      where: { widget_area_id: widget.widget_area_id },
      order: [['display_order', 'ASC'], ['id', 'ASC']]
    });
    const index = siblings.findIndex((row) => row.id === widget.id);
    const direction = req.body.direction === 'up' ? -1 : 1;
    const swap = siblings[index + direction];
    if (!swap) {
      return req.headers.accept?.includes('json')
        ? res.json({ ok: true })
        : res.redirect(`/admin/widgets/${widget.WidgetArea.slug}`);
    }

    const currentOrder = widget.display_order;
    await widget.update({ display_order: swap.display_order });
    await swap.update({ display_order: currentOrder });

    if (req.headers.accept?.includes('json')) return res.json({ ok: true });
    return res.redirect(`/admin/widgets/${widget.WidgetArea.slug}`);
  } catch (error) {
    return next(error);
  }
}

async function deleteWidget(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin/widgets');
    }
    const widget = await models.WidgetInstance.findByPk(req.params.id, { include: [models.WidgetArea] });
    const slug = widget?.WidgetArea?.slug || 'sidebar';
    if (widget) await widget.destroy();
    req.flash('success', 'Widget removed.');
    return res.redirect(`/admin/widgets/${slug}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  index,
  seedDefaults,
  editArea,
  addWidget,
  updateWidget,
  reorderWidget,
  deleteWidget
};
