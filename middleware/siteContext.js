const { Menu, MenuItem, SiteSetting, ThemeSetting, Category, Post } = require('../models');
const pluginLoader = require('../utils/pluginLoader');

function buildMenuTree(items = []) {
  const plainItems = items
    .map((item) => item.get({ plain: true }))
    .sort((a, b) => a.display_order - b.display_order)
    .map((item) => ({ ...item, children: [] }));
  const byId = new Map(plainItems.map((item) => [item.id, item]));
  const roots = [];

  for (const item of plainItems) {
    if (item.parent_id && byId.has(item.parent_id)) {
      byId.get(item.parent_id).children.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}

async function loadSiteContext(req, res, next) {
  try {
    const [settings, theme, menus, categories, recentPosts, popularPosts] = await Promise.all([
      SiteSetting.findAll(),
      ThemeSetting.findOne({ where: { active: true } }),
      Menu.findAll({
        where: { active: true },
        include: [{ model: MenuItem, as: 'items', where: { active: true }, required: false }],
        order: [[{ model: MenuItem, as: 'items' }, 'display_order', 'ASC']]
      }),
      Category.findAll({ limit: 20, order: [['name', 'ASC']] }),
      Post.findAll({ where: { status: 'published' }, limit: 5, order: [['published_at', 'DESC']] }),
      Post.findAll({ where: { status: 'published' }, limit: 5, order: [['views_count', 'DESC']] })
    ]);

    res.locals.siteSettings = settings.reduce((map, row) => ({ ...map, [row.key]: row.value }), {});
    res.locals.activeTheme = theme || {};
    res.locals.siteMenus = menus.reduce((map, menu) => ({ ...map, [menu.location]: buildMenuTree(menu.items || []) }), {});
    res.locals.sidebarCategories = categories;
    res.locals.recentPosts = recentPosts;
    res.locals.popularPosts = popularPosts;
    res.locals.pluginPublicHead = await pluginLoader.collectHook('publicHead', { req, res });
    res.locals.pluginPublicFooter = await pluginLoader.collectHook('publicFooter', { req, res });
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { loadSiteContext, buildMenuTree };
