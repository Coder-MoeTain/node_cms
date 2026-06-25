const fs = require('fs');
const path = require('path');
const { Menu, MenuItem, SiteSetting, ThemeSetting, Category, Post, Media, Plugin } = require('../models');
const pluginLoader = require('../utils/pluginLoader');
const themeLoader = require('../utils/themeLoader');
const { resolveThemePartials } = require('../utils/themePartials');
const { resolvePortalConfig, resolveThemePreset, parseThemeVars, parseDesignTokens } = require('../utils/portalConfig');
const {
  translateMenus,
  translatePosts,
  translateCategories,
  translateSiteSettings
} = require('../utils/contentTranslator');
const { getPortalStats } = require('../utils/portalStats');
const policy = require('../utils/policy');
const { createEngine, normalizeLocale } = require('../utils/translationEngine');

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
    where: { category_id: categoryRow.id, status: 'published', post_type: 'post' },
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

function applyThemePreview(req, themePlain) {
  const previewSlug = req.query.theme_preview;
  if (!previewSlug || typeof previewSlug !== 'string' || !req.session?.user) return themePlain;
  if (!policy.canAccessAdmin(req.session.user, '/admin')) return themePlain;
  if (!themeLoader.getThemeBySlug(previewSlug)) return themePlain;
  return {
    ...themeLoader.buildThemeSettingDefaults(previewSlug),
    theme_name: previewSlug
  };
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
      Post.findAll({ where: { status: 'published', post_type: 'post' }, limit: 5, order: [['published_at', 'DESC']] }),
      Post.findAll({ where: { status: 'published', post_type: 'post' }, limit: 5, order: [['views_count', 'DESC']] }),
      sidebarPostsForCategory('announcements', 5),
      Plugin.findAll({ where: { active: true }, attributes: ['slug'] })
    ]);

    res.locals.siteSettings = settings.reduce((map, row) => ({ ...map, [row.key]: row.value }), {});
    const contentLocale = normalizeLocale(
      res.locals.siteSettings.default_content_locale || process.env.DEFAULT_CONTENT_LOCALE || 'my'
    );
    res.locals.contentLocale = contentLocale;
    res.locals.translationEngine = createEngine(res.locals.locale, {
      sourceLocale: 'en',
      useDatabase: process.env.NODE_ENV !== 'test'
    });
    res.locals.translateText = (text) => res.locals.translationEngine.translate(text);
    res.locals.translateHtml = (html) => res.locals.translationEngine.translateHtml(html);
    let themePlain = applyCustomizerPreview(req, theme ? theme.get({ plain: true }) : {});
    themePlain = applyThemePreview(req, themePlain);
    res.locals.activeTheme = themePlain;
    res.locals.isThemePreview = Boolean(req.query.theme_preview && req.session?.user);
    res.locals.previewThemeSlug = res.locals.isThemePreview ? req.query.theme_preview : null;
    const themeSlug = themePlain.theme_name || 'classic-blog';
    const themeCssPath = path.join(process.cwd(), 'themes', themeSlug, 'assets', 'css', 'theme.css');
    res.locals.themeStylesheet = fs.existsSync(themeCssPath) ? `/themes/${themeSlug}/assets/css/theme.css` : null;
    res.locals.portalConfig = resolvePortalConfig(themePlain);
    res.locals.themePreset = resolveThemePreset(themePlain, res.locals.portalConfig);
    res.locals.themeVars = parseThemeVars(themePlain.custom_css || '');
    res.locals.designTokens = parseDesignTokens(themePlain.custom_css || '');
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
    const { gravatarUrl } = require('../utils/commentHelper');
    res.locals.gravatarUrl = gravatarUrl;
    const siteMenus = menus.reduce((map, menu) => {
      const tree = buildMenuTree(menu.items || []);
      map[menu.location] = tree;
      if (menu.slug) map[menu.slug] = tree;
      return map;
    }, {});
    res.locals.siteMenus = await translateMenus(engine, siteMenus);
    res.locals.quickServiceItems = res.locals.siteMenus['quick-services'] || [];
    res.locals.sidebarCategories = await translateCategories(engine, categories);
    res.locals.recentPosts = await translatePosts(engine, recentPosts, 'post', contentLocale);
    res.locals.popularPosts = await translatePosts(engine, popularPosts, 'post', contentLocale);
    res.locals.announcementPosts = announcementPosts.length
      ? await translatePosts(engine, announcementPosts, 'post', contentLocale)
      : await translatePosts(engine, recentPosts, 'post', contentLocale);
    res.locals.siteSettings = await translateSiteSettings(engine, res.locals.siteSettings);
    res.locals.portalStats = await getPortalStats(res.locals.siteSettings);
    res.locals.activePluginSlugs = activePlugins.map((row) => row.slug);
    const { loadAllWidgetAreas } = require('../utils/widgetRenderer');
    res.locals.widgetAreas = await loadAllWidgetAreas({ recentPosts });
    res.locals.pluginPublicHead = await pluginLoader.collectHook('publicHead', { req, res });
    res.locals.pluginPublicFooter = await pluginLoader.collectHook('publicFooter', { req, res });
    res.locals.currentPath = req.path;
    const sessionUser = req.session?.user || null;
    res.locals.currentUser = sessionUser;
    res.locals.isAdminLoggedIn = Boolean(sessionUser && policy.canAccessAdmin(sessionUser, '/admin'));
    res.locals.canEditPost = (post) => {
      if (!sessionUser || !post?.id) return false;
      const type = post.post_type || 'post';
      if (type === 'post') return policy.canEditPost(sessionUser, post);
      if (type === 'page') return policy.canEditPage(sessionUser, post);
      return policy.hasAnyPermission(sessionUser, ['manage_custom_content', 'manage_posts', 'edit_posts']);
    };
    res.locals.postEditUrl = (post) => {
      if (!post?.id) return '#';
      const type = post.post_type || 'post';
      if (type === 'post') return `/admin/posts/${post.id}/edit`;
      if (type === 'page') return `/admin/pages/${post.id}/edit`;
      return `/admin/content/${type}/${post.id}/edit`;
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { loadSiteContext, buildMenuTree, applyCustomizerPreview, applyThemePreview };
