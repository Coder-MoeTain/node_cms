const models = require('../models');

async function exportSite(options = {}) {
  const includeMedia = options.includeMedia !== false;
  const [posts, pages, categories, tags, types, fieldGroups, menus, widgetAreas] = await Promise.all([
    models.Post.findAll({ where: { post_type: 'post' } }),
    models.Page.findAll(),
    models.Category.findAll(),
    models.Tag.findAll(),
    models.CustomPostType.findAll(),
    models.FieldGroup.findAll({ include: [{ model: models.CustomField, as: 'fields' }] }),
    models.Menu.findAll({ include: [{ model: models.MenuItem, as: 'items' }] }),
    models.WidgetArea.findAll({ include: [{ model: models.WidgetInstance, as: 'widgets' }] })
  ]);

  const customPosts = await models.Post.findAll({ where: { post_type: { [require('sequelize').Op.ne]: 'post' } } });
  const payload = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    posts: posts.map((r) => r.get({ plain: true })),
    pages: pages.map((r) => r.get({ plain: true })),
    custom_post_types: types.map((r) => r.get({ plain: true })),
    custom_posts: customPosts.map((r) => r.get({ plain: true })),
    categories: categories.map((r) => r.get({ plain: true })),
    tags: tags.map((r) => r.get({ plain: true })),
    field_groups: fieldGroups.map((r) => r.get({ plain: true })),
    menus: menus.map((r) => r.get({ plain: true })),
    widget_areas: widgetAreas.map((r) => r.get({ plain: true }))
  };

  if (includeMedia) {
    payload.media = (await models.Media.findAll()).map((r) => r.get({ plain: true }));
  }

  return payload;
}

module.exports = { exportSite };
