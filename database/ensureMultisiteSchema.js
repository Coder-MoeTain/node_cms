const { tableExists } = require('./ensureBaseSchema');
const { columnExists, ensureColumn } = require('./migrationHelpers');

const SITE_SCOPED_TABLES = [
  'posts',
  'pages',
  'categories',
  'menus',
  'media',
  'tags',
  'widget_areas',
  'custom_post_types',
  'taxonomies',
  'comments',
  'field_groups',
  'banners',
  'sliders',
  'site_settings',
  'taxonomy_terms',
  'widget_instances'
];

async function ensureSiteScopeColumns(sequelize, transaction = null) {
  const added = [];

  for (const table of SITE_SCOPED_TABLES) {
    if (!(await tableExists(sequelize, table, transaction))) continue;
    if (await columnExists(sequelize, table, 'site_id', transaction)) continue;
    await ensureColumn(
      sequelize,
      { table, column: 'site_id', definition: 'INT UNSIGNED NULL AFTER id' },
      transaction
    );
    added.push(`${table}.site_id`);
  }

  return added;
}

module.exports = {
  SITE_SCOPED_TABLES,
  ensureSiteScopeColumns
};
