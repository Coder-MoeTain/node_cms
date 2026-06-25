const { Op } = require('sequelize');
const models = require('../../models');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { loadCustomFieldsMap } = require('../../utils/customFields');
const { parseShortcodes } = require('../../utils/shortcodeParser');
const { translatePost, translatePosts } = require('../../utils/contentTranslator');

async function archive(req, res, next) {
  try {
    const type = await models.CustomPostType.findOne({
      where: { slug: req.params.typeSlug, status: 'active', has_archive: true }
    });
    if (!type) return res.status(404).render('errors/404', { title: 'Not Found' });

    const { page, limit, offset } = getPagination(req, 10);
    const { rows, count } = await models.Post.findAndCountAll({
      where: { post_type: type.slug, status: 'published' },
      include: [{ model: models.User, as: 'author', attributes: ['id', 'name'] }],
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });

    const engine = res.locals.translationEngine;
    const posts = await translatePosts(engine, rows, 'custom_post');
    const title = engine?.isActive ? await engine.translate(type.name) : type.name;

    return res.render('public/custom-archive', {
      title,
      type,
      posts,
      pagination: pageMeta(count, page, limit)
    });
  } catch (error) {
    return next(error);
  }
}

async function single(req, res, next) {
  try {
    const type = await models.CustomPostType.findOne({
      where: { slug: req.params.typeSlug, status: 'active' }
    });
    if (!type) return res.status(404).render('errors/404', { title: 'Not Found' });

    const postRow = await models.Post.findOne({
      where: {
        post_type: type.slug,
        slug: req.params.itemSlug,
        status: { [Op.in]: ['published', 'private'] }
      },
      include: [{ model: models.User, as: 'author', attributes: ['id', 'name'] }]
    });
    if (!postRow) return res.status(404).render('errors/404', { title: 'Not Found' });

    await postRow.increment('views_count');

    const engine = res.locals.translationEngine;
    const post = await translatePost(engine, postRow, 'custom_post');

    let customFields = {};
    if (type.supports_custom_fields) {
      customFields = await loadCustomFieldsMap('custom_post', post.id, 'custom_post_type', type.slug);
    }

    const content = parseShortcodes(post.content, { recentPosts: res.locals.recentPosts || [] });

    return res.render('public/custom-single', {
      title: post.seo_title || post.title,
      type,
      post: { ...post, content },
      customFields,
      content
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { archive, single };
