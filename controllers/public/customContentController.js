const { Op } = require('sequelize');
const models = require('../../models');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { loadCustomFieldsMap } = require('../../utils/customFields');
const { resolvePublicContent } = require('../../utils/publicContentRenderer');
const { attachFseLocals } = require('../../utils/fsePublicHelper');
const { siteScopeWhere } = require('../../utils/siteScope');
const { translatePost, translatePosts } = require('../../utils/contentTranslator');
const { renderPublicError } = require('../../utils/publicErrorRender');

async function archive(req, res, next) {
  try {
    const type = await models.CustomPostType.findOne({
      where: siteScopeWhere(req, { slug: req.params.typeSlug, status: 'active', has_archive: true })
    });
    if (!type) return renderPublicError(res, { title: 'Not Found', code: 404, message: 'This content type could not be found.' });

    const { page, limit, offset } = getPagination(req, 10);
    const { rows, count } = await models.Post.findAndCountAll({
      where: siteScopeWhere(req, { post_type: type.slug, status: 'published' }),
      include: [{ model: models.User, as: 'author', attributes: ['id', 'name'] }],
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });

    const engine = res.locals.translationEngine;
    const contentLocale = res.locals.contentLocale;
    const posts = await translatePosts(engine, rows, 'custom_post', contentLocale);
    const title = engine?.isActive ? await engine.translate(type.name) : type.name;

    const themeSlug = res.locals.activeTheme?.theme_name || res.locals.activeTheme?.slug;
    const locals = await attachFseLocals(`archive-${type.slug}`, {
      title,
      type,
      posts,
      pagination: pageMeta(count, page, limit),
      heading: title
    }, themeSlug, { recentPosts: res.locals.recentPosts || [] });

    return res.render('public/custom-archive', locals);
  } catch (error) {
    return next(error);
  }
}

async function single(req, res, next) {
  try {
    const type = await models.CustomPostType.findOne({
      where: siteScopeWhere(req, { slug: req.params.typeSlug, status: 'active' })
    });
    if (!type) return renderPublicError(res, { title: 'Not Found', code: 404, message: 'This content type could not be found.' });

    const postRow = await models.Post.findOne({
      where: siteScopeWhere(req, {
        post_type: type.slug,
        slug: req.params.itemSlug,
        status: { [Op.in]: ['published', 'private'] }
      }),
      include: [{ model: models.User, as: 'author', attributes: ['id', 'name'] }]
    });
    if (!postRow) return renderPublicError(res, { title: 'Not Found', code: 404, message: 'This item could not be found or is no longer published.' });

    await postRow.increment('views_count');

    const engine = res.locals.translationEngine;
    const contentLocale = res.locals.contentLocale;
    const post = await translatePost(engine, postRow, 'custom_post', contentLocale);

    let customFields = {};
    if (type.supports_custom_fields) {
      customFields = await loadCustomFieldsMap('custom_post', post.id, 'custom_post_type', type.slug);
    }

    const content = resolvePublicContent(post, { recentPosts: res.locals.recentPosts || [] });

    const themeSlug = res.locals.activeTheme?.theme_name || res.locals.activeTheme?.slug;
    const locals = await attachFseLocals(`single-${type.slug}`, {
      title: post.seo_title || post.title,
      type,
      post: { ...post, content },
      customFields,
      content
    }, themeSlug, { recentPosts: res.locals.recentPosts || [] });

    return res.render('public/custom-single', locals);
  } catch (error) {
    return next(error);
  }
}

module.exports = { archive, single };
