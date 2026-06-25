const models = require('../../models');
const policy = require('../../utils/policy');
const { WIDGET_TYPES, parseSettings } = require('../../utils/widgetRenderer');

async function index(req, res, next) {
  try {
    if (!policy.hasPermission(req.session.user, 'manage_settings')) {
      req.flash('error', 'You do not have permission.');
      return res.redirect('/admin');
    }
    const areas = await models.WidgetArea.findAll({
      include: [{ model: models.WidgetInstance, as: 'widgets' }],
      order: [['display_order', 'ASC']]
    });
    return res.render('admin/widgets/index', { title: 'Widgets', areas, widgetTypes: WIDGET_TYPES });
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
    return res.render('admin/widgets/area', {
      title: `Widgets — ${area.name}`,
      area,
      widgetTypes: WIDGET_TYPES
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
    const type = WIDGET_TYPES.includes(req.body.widget_type) ? req.body.widget_type : 'text';
    await models.WidgetInstance.create({
      widget_area_id: area.id,
      widget_type: type,
      title: req.body.title || '',
      settings_json: JSON.stringify({ content: req.body.content || '', limit: req.body.limit || 5 }),
      display_order: Number(req.body.display_order) || 0,
      status: 'active'
    });
    req.flash('success', 'Widget added.');
    return res.redirect(`/admin/widgets/${area.slug}`);
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

module.exports = { index, editArea, addWidget, deleteWidget };
