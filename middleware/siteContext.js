const { Menu, MenuItem, SiteSetting, ThemeSetting, Category, Post, Media, Plugin } = require('../models');
const pluginLoader = require('../utils/pluginLoader');
const themeLoader = require('../utils/themeLoader');
const { resolveThemePartials } = require('../utils/themePartials');
const { resolvePortalConfig, resolveThemePreset, parseThemeVars } = require('../utils/portalConfig');
const {
  translateMenus,
  translatePosts,
  translateCategories,
  translateSiteSettings
} = require('../utils/contentTranslator');
const { getPortalStats } = require('../utils/portalStats');

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

function applyCustomizerPreview(req, themePlain) {
  if (req.query.customizer_preview !== '1' || !req.session?.user) return themePlain;
  const draft = req.session.customizerDraft;
  if (!draft || typeof draft !== 'object') return themePlain;
  return { ...themePlain, ...draft };
}

async function loadSiteContext(req, res, next) {
  try {
    const [settings, theme, menus, categories, recentPosts, popularPosts, announcementPosts, activePlugins] = await Promise.all([
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
      sidebarPostsForCategory('announcements', 5),
      Plugin.findAll({ where: { active: true }, attributes: ['slug'] })
    ]);

    res.locals.siteSettings = settings.reduce((map, row) => ({ ...map, [row.key]: row.value }), {});
    const themePlain = applyCustomizerPreview(req, theme ? theme.get({ plain: true }) : {});
    res.locals.activeTheme = themePlain;
    res.locals.portalConfig = resolvePortalConfig(themePlain);
    res.locals.themePreset = resolveThemePreset(themePlain, res.locals.portalConfig);
    res.locals.themeVars = parseThemeVars(themePlain.custom_css || '');
    res.locals.themeLayoutClasses = themeLoader.getLayoutClasses(themePlain);
    res.locals.themePartials = await resolveThemePartials();
    res.locals.themePartial = (name) => res.locals.themePartials[name] || `public/partials/${name}`;
    res.locals.isCustomizerPreview = req.query.customizer_preview === '1' && Boolean(req.session?.user);
    res.locals.isPortal =
      res.locals.portalConfig.header?.layout === 'portal' ||
      themePlain.header_layout === 'portal' ||
      res.locals.themePreset === 'myanmar-portal';
    res.locals.formatDate = (value) => {
      if (!value) return '';
      const date = value instanceof Date ? value : new Date(value);
      return date.toLocaleDateString(res.locals.locale || undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };
    const engine = res.locals.translationEngine;
    const siteMenus = menus.reduce((map, menu) => {
      const tree = buildMenuTree(menu.items || []);
      map[menu.location] = tree;
      if (menu.slug) map[menu.slug] = tree;
      return map;
    }, {});
    res.locals.siteMenus = await translateMenus(engine, siteMenus);
    res.locals.quickServiceItems = res.locals.siteMenus['quick-services'] || [];
    res.locals.sidebarCategories = await translateCategories(engine, categories);
    res.locals.recentPosts = await translatePosts(engine, recentPosts);
    res.locals.popularPosts = await translatePosts(engine, popularPosts);
    res.locals.announcementPosts = announcementPosts.length
      ? await translatePosts(engine, announcementPosts)
      : await translatePosts(engine, recentPosts);
    res.locals.siteSettings = await translateSiteSettings(engine, res.locals.siteSettings);
    res.locals.portalStats = await getPortalStats(res.locals.siteSettings);
    res.locals.activePluginSlugs = activePlugins.map((row) => row.slug);
    res.locals.pluginPublicHead = await pluginLoader.collectHook('publicHead', { req, res });
    res.locals.pluginPublicFooter = await pluginLoader.collectHook('publicFooter', { req, res });
    res.locals.currentPath = req.path;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { loadSiteContext, buildMenuTree, applyCustomizerPreview };
