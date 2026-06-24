const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const { validationResult } = require('express-validator');
const {
  Post,
  Page,
  Category,
  Tag,
  User,
  Banner,
  Slider,
  Comment,
  ContactMessage,
  SiteSetting,
  Media
} = require('../../models');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { meta, postSchema, websiteSchema } = require('../../utils/seoHelper');
const appConfig = require('../../config/app');
const themeLoader = require('../../utils/themeLoader');

const publishedPostInclude = [{ model: Category }, { model: User, as: 'author' }, Tag];

async function renderTheme(res, template, locals) {
  return res.render(await themeLoader.resolveTemplate(template), locals);
}

async function postsForCategorySlug(slug, limit = 6) {
  const categoryRow = await Category.findOne({ where: { slug } });
  if (!categoryRow) return [];
  return Post.findAll({
    where: { category_id: categoryRow.id, status: 'published' },
    include: publishedPostInclude,
    limit,
    order: [['published_at', 'DESC']]
  });
}

async function home(req, res, next) {
  try {
    const [
      posts,
      banners,
      sliders,
      newsPosts,
      announcementPosts,
      tenderPosts,
      jobPosts,
      hotPosts,
      mediaItems
    ] = await Promise.all([
      Post.findAll({ where: { status: 'published' }, include: publishedPostInclude, limit: 6, order: [['published_at', 'DESC']] }),
      Banner.findAll({ where: { active: true }, order: [['display_order', 'ASC']] }),
      Slider.findAll({ where: { active: true }, order: [['display_order', 'ASC']] }),
      postsForCategorySlug('news', 6),
      postsForCategorySlug('announcements', 6),
      postsForCategorySlug('tenders', 5),
      postsForCategorySlug('jobs', 5),
      Post.findAll({ where: { status: 'published' }, include: publishedPostInclude, limit: 8, order: [['views_count', 'DESC']] }),
      Media.findAll({ where: { file_type: { [Op.in]: ['image', 'video'] } }, limit: 8, order: [['created_at', 'DESC']] })
    ]);

    const latestNews = newsPosts.length ? newsPosts : posts.slice(0, 6);
    const announcements = announcementPosts.length ? announcementPosts : posts.slice(0, 6);

    const { siteSettings } = res.locals;
    const siteName = siteSettings.site_title || appConfig.name;
    const siteTagline = siteSettings.site_tagline || 'Official information portal powered by NodePress';

    return renderTheme(res, 'home', {
      title: 'Home',
      seo: meta('Home', siteTagline, '', {
        siteName,
        canonical: `${appConfig.url}/`,
        defaultDescription: siteTagline
      }),
      schema: websiteSchema(siteSettings, appConfig.url),
      posts,
      banners,
      sliders,
      latestNews,
      announcements,
      tenderPosts,
      jobPosts,
      hotPosts,
      mediaItems
    });
  } catch (error) {
    return next(error);
  }
}

async function blog(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, Number(res.locals.siteSettings.posts_per_page || 6));
    const { rows, count } = await Post.findAndCountAll({
      where: { status: 'published' },
      include: publishedPostInclude,
      distinct: true,
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    return renderTheme(res, 'blog', { title: 'Blog', seo: meta('Blog'), posts: rows, pagination: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function post(req, res, next) {
  try {
    const row = await Post.findOne({
      where: { slug: req.params.slug, status: 'published' },
      include: [...publishedPostInclude, { model: Comment, as: 'comments', where: { status: 'approved' }, required: false }]
    });
    if (!row) return res.status(404).render('public/error', { title: 'Post Not Found', code: 404, message: 'This post could not be found or is no longer published.' });
    await row.increment('views_count');
    const [relatedPosts, prevPost, nextPost] = await Promise.all([
      Post.findAll({
        where: {
          id: { [Op.ne]: row.id },
          status: 'published',
          ...(row.category_id ? { category_id: row.category_id } : {})
        },
        include: publishedPostInclude,
        limit: 3,
        order: [['published_at', 'DESC']]
      }),
      Post.findOne({
        where: { status: 'published', published_at: { [Op.lt]: row.published_at || row.created_at } },
        order: [['published_at', 'DESC']],
        attributes: ['title', 'slug']
      }),
      Post.findOne({
        where: { status: 'published', published_at: { [Op.gt]: row.published_at || row.created_at } },
        order: [['published_at', 'ASC']],
        attributes: ['title', 'slug']
      })
    ]);
    return renderTheme(res, 'post', {
      title: row.title,
      seo: meta(row.seo_title || row.title, row.seo_description || row.excerpt, row.og_image || row.featured_image),
      post: row,
      relatedPosts,
      prevPost,
      nextPost,
      schema: postSchema(row, `${req.protocol}://${req.get('host')}${req.originalUrl}`)
    });
  } catch (error) {
    return next(error);
  }
}

async function category(req, res, next) {
  try {
    const categoryRow = await Category.findOne({ where: { slug: req.params.slug } });
    if (!categoryRow) return res.status(404).render('public/error', { title: 'Category Not Found', code: 404, message: 'This category could not be found.' });
    const { page, limit, offset } = getPagination(req, Number(res.locals.siteSettings.posts_per_page || 6));
    const { rows, count } = await Post.findAndCountAll({
      where: { category_id: categoryRow.id, status: 'published' },
      include: publishedPostInclude,
      distinct: true,
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    return renderTheme(res, 'archive', { title: categoryRow.name, seo: meta(categoryRow.name, categoryRow.description), heading: categoryRow.name, posts: rows, pagination: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function tag(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, Number(res.locals.siteSettings.posts_per_page || 6));
    const tagRow = await Tag.findOne({ where: { slug: req.params.slug } });
    if (!tagRow) return res.status(404).render('public/error', { title: 'Tag Not Found', code: 404, message: 'This tag could not be found.' });
    const { rows, count } = await Post.findAndCountAll({
      where: { status: 'published' },
      include: [...publishedPostInclude, { model: Tag, where: { id: tagRow.id } }],
      distinct: true,
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    return renderTheme(res, 'archive', { title: tagRow.name, seo: meta(tagRow.name), heading: `Tag: ${tagRow.name}`, posts: rows, pagination: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function page(req, res, next) {
  try {
    const row = await Page.findOne({ where: { slug: req.params.slug, status: 'published' } });
    if (!row) return res.status(404).render('public/error', { title: 'Page Not Found', code: 404, message: 'This page could not be found.' });
    return renderTheme(res, 'page', {
      title: row.title,
      seo: meta(row.seo_title || row.title, row.seo_description, row.og_image || row.featured_image),
      page: row
    });
  } catch (error) {
    return next(error);
  }
}

async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    const { page, limit, offset } = getPagination(req, Number(res.locals.siteSettings.posts_per_page || 6));
    let posts = [];
    let pages = [];
    let count = 0;

    if (q) {
      const postResult = await Post.findAndCountAll({
        where: {
          status: 'published',
          [Op.or]: [
            { title: { [Op.like]: `%${q}%` } },
            { excerpt: { [Op.like]: `%${q}%` } },
            { content: { [Op.like]: `%${q}%` } }
          ]
        },
        include: publishedPostInclude,
        distinct: true,
        limit,
        offset,
        order: [['published_at', 'DESC']]
      });
      posts = postResult.rows;
      count = postResult.count;

      pages = await Page.findAll({
        where: {
          status: 'published',
          [Op.or]: [
            { title: { [Op.like]: `%${q}%` } },
            { content: { [Op.like]: `%${q}%` } }
          ]
        },
        limit: 8,
        order: [['updated_at', 'DESC']]
      });
    }

    return renderTheme(res, 'search', {
      title: 'Search',
      seo: meta('Search', q ? `Results for ${q}` : 'Search the site'),
      q,
      posts,
      pages,
      pagination: q ? pageMeta(count, page, limit) : null
    });
  } catch (error) {
    return next(error);
  }
}

async function contact(req, res, next) {
  try {
    const prefill = {
      subject: req.query.subject || '',
      email: req.query.email || ''
    };
    return renderTheme(res, 'contact', { title: 'Contact', seo: meta('Contact'), prefill });
  } catch (error) {
    return next(error);
  }
}

async function submitContact(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg || 'Please check the contact form.');
      return res.redirect('/contact');
    }

    await ContactMessage.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      subject: req.body.subject,
      message: sanitizeHtml(req.body.message || '', { allowedTags: [], allowedAttributes: {} })
    });
    req.flash('success', 'Thanks. Your message has been sent.');
    return res.redirect('/contact');
  } catch (error) {
    return next(error);
  }
}

async function comment(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error', errors.array()[0].msg || 'Please check your comment.');
      return res.redirect('back');
    }

    const postRow = await Post.findByPk(req.params.id);
    if (!postRow || !postRow.allow_comments) {
      req.flash('error', 'Comments are closed.');
      return res.redirect('back');
    }
    await Comment.create({
      post_id: postRow.id,
      name: req.body.name,
      email: req.body.email,
      website: req.body.website,
      content: sanitizeHtml(req.body.content || '', { allowedTags: [], allowedAttributes: {} }),
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'pending'
    });
    req.flash('success', 'Comment submitted for moderation.');
    return res.redirect(`/post/${postRow.slug}`);
  } catch (error) {
    return next(error);
  }
}

async function sitemap(req, res, next) {
  try {
    const [posts, pages] = await Promise.all([
      Post.findAll({ where: { status: 'published' }, attributes: ['slug', 'updated_at'] }),
      Page.findAll({ where: { status: 'published' }, attributes: ['slug', 'updated_at'] })
    ]);
    const host = `${req.protocol}://${req.get('host')}`;
    const urls = [
      `${host}/`,
      `${host}/blog`,
      ...posts.map((row) => `${host}/post/${row.slug}`),
      ...pages.map((row) => `${host}/page/${row.slug}`)
    ];
    res.type('application/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
      .map((url) => `<url><loc>${url}</loc></url>`)
      .join('')}</urlset>`);
  } catch (error) {
    return next(error);
  }
}

function robots(req, res) {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml`);
}

module.exports = { home, blog, post, category, tag, page, search, contact, submitContact, comment, sitemap, robots };
