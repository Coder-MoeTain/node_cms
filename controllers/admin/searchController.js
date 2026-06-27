const { Op } = require('sequelize');
const models = require('../../models');
const policy = require('../../utils/policy');
const { siteScopeWhere } = require('../../utils/siteScope');

async function adminSearch(req, res, next) {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ data: { posts: [], pages: [], media: [], customPosts: [] } });
    }
    const like = { [Op.like]: `%${q}%` };
    const limit = Math.min(Number(req.query.limit) || 8, 20);

    const customPostPromise = policy.hasPermission(req.session.user, 'manage_custom_content')
      ? models.Post.findAll({
        where: siteScopeWhere(req, {
          post_type: { [Op.ne]: 'post' },
          [Op.or]: [{ title: like }, { slug: like }]
        }),
        attributes: ['id', 'title', 'slug', 'status', 'post_type'],
        limit,
        order: [['updated_at', 'DESC']]
      })
      : [];

    const [posts, pages, media, customPosts] = await Promise.all([
      policy.hasPermission(req.session.user, 'manage_posts')
        ? models.Post.findAll({
          where: siteScopeWhere(req, {
            post_type: 'post',
            [Op.or]: [{ title: like }, { slug: like }]
          }),
          attributes: ['id', 'title', 'slug', 'status'],
          limit,
          order: [['updated_at', 'DESC']]
        })
        : [],
      policy.hasPermission(req.session.user, 'manage_pages')
        ? models.Page.findAll({
          where: siteScopeWhere(req, { [Op.or]: [{ title: like }, { slug: like }] }),
          attributes: ['id', 'title', 'slug', 'status'],
          limit,
          order: [['updated_at', 'DESC']]
        })
        : [],
      policy.hasPermission(req.session.user, 'manage_media')
        ? models.Media.findAll({
          where: siteScopeWhere(req, { original_name: like }),
          attributes: ['id', 'original_name', 'file_path', 'file_type'],
          limit,
          order: [['created_at', 'DESC']]
        })
        : [],
      customPostPromise
    ]);

    return res.json({
      data: {
        query: q,
        posts: posts.map((r) => ({ id: r.id, title: r.title, slug: r.slug, status: r.status, href: `/admin/posts/${r.id}/edit` })),
        pages: pages.map((r) => ({ id: r.id, title: r.title, slug: r.slug, status: r.status, href: `/admin/pages/${r.id}/edit` })),
        media: media.map((r) => ({ id: r.id, title: r.original_name, href: `/admin/media/${r.id}/edit`, file_path: r.file_path, file_type: r.file_type })),
        customPosts: customPosts.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          status: r.status,
          post_type: r.post_type,
          href: `/admin/content/${r.post_type}/${r.id}/edit`
        }))
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { adminSearch };
