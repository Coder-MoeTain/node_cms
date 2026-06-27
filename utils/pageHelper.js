const { Page } = require('../models');
const { pagePath } = require('./permalinkHelper');

async function buildPageBreadcrumbs(page, permalinkSettings) {
  const crumbs = [{ label: 'Home', url: '/' }];
  const chain = [];
  let parentId = page.parent_id;
  let parentRow = page.parent || null;

  while (parentId) {
    const row = parentRow && Number(parentRow.id) === Number(parentId)
      ? parentRow
      : await Page.findByPk(parentId, { attributes: ['id', 'title', 'slug', 'parent_id'] });
    if (!row) break;
    chain.unshift(row);
    parentId = row.parent_id;
    parentRow = null;
  }

  for (const row of chain) {
    crumbs.push({ label: row.title, url: pagePath(row, permalinkSettings) });
  }
  crumbs.push({ label: page.title });
  return crumbs;
}

async function loadChildPages(pageId) {
  return Page.findAll({
    where: { parent_id: pageId, status: 'published' },
    order: [['menu_order', 'ASC'], ['title', 'ASC']],
    attributes: ['id', 'title', 'slug', 'excerpt', 'menu_order']
  });
}

module.exports = { buildPageBreadcrumbs, loadChildPages };
