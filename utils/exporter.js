const models = require('../models');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

function siteWhere(siteId) {
  if (!siteId) return {};
  return { [Op.or]: [{ site_id: null }, { site_id: siteId }] };
}

async function exportSite(options = {}) {
  const includeMedia = options.includeMedia !== false;
  const scope = siteWhere(options.siteId);

  const [posts, pages, categories, tags, types, fieldGroups, menus, widgetAreas, taxonomies] = await Promise.all([
    models.Post.findAll({ where: { ...scope, post_type: 'post' } }),
    models.Page.findAll({ where: scope }),
    models.Category.findAll({ where: scope }),
    models.Tag.findAll({ where: scope }),
    models.CustomPostType.findAll({ where: scope }),
    models.FieldGroup.findAll({ where: scope, include: [{ model: models.CustomField, as: 'fields' }] }),
    models.Menu.findAll({ where: scope, include: [{ model: models.MenuItem, as: 'items' }] }),
    models.WidgetArea.findAll({ where: scope, include: [{ model: models.WidgetInstance, as: 'widgets' }] }),
    models.Taxonomy.findAll({ where: scope, include: [{ model: models.TaxonomyTerm, as: 'terms' }] })
  ]);

  const customPosts = await models.Post.findAll({
    where: { ...scope, post_type: { [Op.ne]: 'post' } }
  });

  const postIds = [...posts, ...customPosts].map((r) => r.id);
  const fieldValues = postIds.length
    ? await models.CustomFieldValue.findAll({
      where: { resource_type: { [Op.in]: ['post', 'custom_post'] }, resource_id: postIds },
      include: [{ model: models.CustomField }]
    })
    : [];

  const valuesByPost = new Map();
  for (const row of fieldValues) {
    const list = valuesByPost.get(row.resource_id) || [];
    const field = row.CustomField;
    if (field?.name) {
      list.push({ key: `np_field_${field.name}`, value: row.value_text });
    }
    valuesByPost.set(row.resource_id, list);
  }

  const mapWithMeta = (rows) => rows.map((r) => {
    const plain = r.get({ plain: true });
    plain.custom_fields_meta = valuesByPost.get(r.id) || [];
    return plain;
  });

  const [postTaxonomyTerms] = await sequelize.query('SELECT post_id, term_id FROM post_taxonomy_terms');
  const payload = {
    version: '1.1',
    exported_at: new Date().toISOString(),
    site_id: options.siteId || null,
    posts: mapWithMeta(posts),
    pages: pages.map((r) => r.get({ plain: true })),
    custom_post_types: types.map((r) => r.get({ plain: true })),
    custom_posts: mapWithMeta(customPosts),
    categories: categories.map((r) => r.get({ plain: true })),
    tags: tags.map((r) => r.get({ plain: true })),
    taxonomies: taxonomies.map((r) => r.get({ plain: true })),
    post_taxonomy_terms: postTaxonomyTerms,
    field_groups: fieldGroups.map((r) => r.get({ plain: true })),
    menus: menus.map((r) => r.get({ plain: true })),
    widget_areas: widgetAreas.map((r) => r.get({ plain: true }))
  };

  if (includeMedia) {
    payload.media = (await models.Media.findAll({ where: scope })).map((r) => r.get({ plain: true }));
  }

  return payload;
}

module.exports = { exportSite };
