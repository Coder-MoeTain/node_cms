const { Menu, MenuItem, SiteSetting, ThemeSetting, Category, Post, Media } = require('../models');
const pluginLoader = require('../utils/pluginLoader');
const { resolvePortalConfig, resolveThemePreset, parseThemeVars } = require('../utils/portalConfig');

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

async function sidebarPostsForCategory(slug, limit = 5) {
  const categoryRow = await Category.findOne({ where: { slug } });
  if (!categoryRow) return [];
  return Post.findAll({
    where: { category_id: categoryRow.id, status: 'published' },
    limit,
    order: [['published_at', 'DESC']],
    attributes: ['id', 'title', 'slug', 'published_at']
  });
}

async function loadSiteContext(req, res, next) {
  try {
    const [settings, theme, menus, categories, recentPosts, popularPosts, announcementPosts] = await Promise.all([
      SiteSetting.findAll(),
      ThemeSetting.findOne({ where: { active: true } }),
      Menu.findAll({
        where: { active: true },
        include: [{ model: MenuItem, as: 'items', where: { active: true }, required: false }],
        order: [[{ model: MenuItem, as: 'items' }, 'display_order', 'ASC']]
      }),
      Category.findAll({ limit: 20, order: [['name', 'ASC']] }),
      Post.findAll({ where: { status: 'published' }, limit: 5, order: [['published_at', 'DESC']] }),
      Post.findAll({ where: { status: 'published' }, limit: 5, order: [['views_count', 'DESC']] }),
      sidebarPostsForCategory('announcements', 5)
    ]);

    res.locals.siteSettings = settings.reduce((map, row) => ({ ...map, [row.key]: row.value }), {});
    const themePlain = theme ? theme.get({ plain: true }) : {};
    res.locals.activeTheme = themePlain;
    res.locals.portalConfig = resolvePortalConfig(themePlain);
    res.locals.themePreset = resolveThemePreset(themePlain, res.locals.portalConfig);
    res.locals.themeVars = parseThemeVars(themePlain.custom_css || '');
    res.locals.isPortal =
      res.locals.portalConfig.header?.layout === 'portal' ||
      themePlain.header_layout === 'portal' ||
      res.locals.themePreset === 'myanmar-portal';
    res.locals.formatDate = (value) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };
    res.locals.siteMenus = menus.reduce((map, menu) => ({ ...map, [menu.location]: buildMenuTree(menu.items || []) }), {});
    res.locals.sidebarCategories = categories;
    res.locals.recentPosts = recentPosts;
    res.locals.popularPosts = popularPosts;
    res.locals.announcementPosts = announcementPosts.length ? announcementPosts : recentPosts;
    res.locals.pluginPublicHead = await pluginLoader.collectHook('publicHead', { req, res });
    res.locals.pluginPublicFooter = await pluginLoader.collectHook('publicFooter', { req, res });
    res.locals.currentPath = req.path;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { loadSiteContext, buildMenuTree };
