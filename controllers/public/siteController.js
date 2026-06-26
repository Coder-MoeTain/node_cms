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
const pluginLoader = require('../../utils/pluginLoader');
const themeLoader = require('../../utils/themeLoader');
const {
  translatePost,
  translatePosts,
  translatePage,
  translatePages,
  translateCategory,
  translateTag,
  translateBanners,
  translateSliders
} = require('../../utils/contentTranslator');
const { expandSlidersToSlides } = require('../../utils/sliderHelper');

const publishedPostInclude = [{ model: Category }, { model: User, as: 'author' }, Tag];

async function renderTheme(res, template, locals, templateContext = {}) {
  return res.render(await themeLoader.resolveTemplate(template, templateContext), locals);
}

async function translateViewData(res, data) {
  const engine = res.locals.translationEngine;
  const contentLocale = res.locals.contentLocale || null;
  const output = { ...data };

  if (output.post) output.post = await translatePost(engine, output.post, 'post', contentLocale);
  if (output.posts) output.posts = await translatePosts(engine, output.posts, 'post', contentLocale);
  if (output.page) output.page = await translatePage(engine, output.page, contentLocale);
  if (output.pages) output.pages = await translatePages(engine, output.pages, contentLocale);
  if (output.relatedPosts) output.relatedPosts = await translatePosts(engine, output.relatedPosts, 'post', contentLocale);
  if (output.prevPost) output.prevPost = await translatePost(engine, output.prevPost, 'post', contentLocale);
  if (output.nextPost) output.nextPost = await translatePost(engine, output.nextPost, 'post', contentLocale);
  if (output.latestNews) output.latestNews = await translatePosts(engine, output.latestNews, 'post', contentLocale);
  if (output.announcements) output.announcements = await translatePosts(engine, output.announcements, 'post', contentLocale);
  if (output.tenderPosts) output.tenderPosts = await translatePosts(engine, output.tenderPosts, 'post', contentLocale);
  if (output.jobPosts) output.jobPosts = await translatePosts(engine, output.jobPosts, 'post', contentLocale);
  if (output.hotPosts) output.hotPosts = await translatePosts(engine, output.hotPosts, 'post', contentLocale);
  if (output.banners) output.banners = await translateBanners(engine, output.banners);
  if (output.sliders) {
    const translated = await translateSliders(engine, output.sliders);
    output.sliders = expandSlidersToSlides(translated);
  }
  if (engine?.isActive) {
    if (output.title && typeof output.title === 'string') output.title = await engine.translate(output.title);
    if (output.heading && typeof output.heading === 'string') output.heading = await engine.translate(output.heading);
    if (output.seo) {
      output.seo = { ...output.seo };
      if (output.seo.title) output.seo.title = await engine.translate(output.seo.title);
      if (output.seo.description) output.seo.description = await engine.translate(output.seo.description);
    }
  }

  return output;
}

async function applyRenderHooks(res, locals, hookNames = {}) {
  const context = { req: res.req, res, template: hookNames.template };
  let data = locals;
  if (hookNames.before) {
    const filtered = await pluginLoader.applyFilters(hookNames.before, data, context);
    if (filtered === false || filtered === null) return null;
    data = filtered || data;
  }
  const translated = await translateViewData(res, data);
  if (hookNames.after) {
    await pluginLoader.doAction(hookNames.after, translated, context);
  }
  return translated;
}

async function renderPublic(res, template, locals, renderHooks = null, templateContext = {}) {
  const hooks = renderHooks || {};
  if (!hooks.template) hooks.template = template;
  const data = await applyRenderHooks(res, locals, hooks);
  if (data === null) {
    return res.status(404).render('public/error', { title: 'Not Found', code: 404, message: 'This content is not available.' });
  }
  return renderTheme(res, template, data, templateContext);
}

async function postsForCategorySlug(slug, limit = 6) {
  const categoryRow = await Category.findOne({ where: { slug } });
  if (!categoryRow) return [];
  return Post.findAll({
    where: { category_id: categoryRow.id, status: 'published', post_type: 'post' },
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
      Post.findAll({ where: { status: 'published', post_type: 'post' }, include: publishedPostInclude, limit: 6, order: [['published_at', 'DESC']] }),
      Banner.findAll({ where: { active: true }, order: [['display_order', 'ASC']] }),
      Slider.findAll({ where: { active: true }, order: [['display_order', 'ASC']] }),
      postsForCategorySlug('news', 6),
      postsForCategorySlug('announcements', 6),
      postsForCategorySlug('tenders', 5),
      postsForCategorySlug('jobs', 5),
      Post.findAll({ where: { status: 'published', post_type: 'post' }, include: publishedPostInclude, limit: 8, order: [['views_count', 'DESC']] }),
      Media.findAll({ where: { file_type: { [Op.in]: ['image', 'video'] } }, limit: 8, order: [['created_at', 'DESC']] })
    ]);

    const latestNews = newsPosts.length ? newsPosts : posts.slice(0, 6);
    const announcements = announcementPosts.length ? announcementPosts : posts.slice(0, 6);

    const { siteSettings } = res.locals;
    const siteName = siteSettings.site_title || appConfig.name;
    const siteTagline = siteSettings.site_tagline || 'Official information portal powered by NodePress';

    return renderPublic(res, 'home', {
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
    }, null, { isFrontPage: true });
  } catch (error) {
    return next(error);
  }
}

async function blog(req, res, next) {
  try {
    const { page, limit, offset } = getPagination(req, Number(res.locals.siteSettings.posts_per_page || 6));
    const { rows, count } = await Post.findAndCountAll({
      where: { status: 'published', post_type: 'post' },
      include: publishedPostInclude,
      distinct: true,
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    return renderPublic(res, 'blog', { title: 'Blog', seo: meta('Blog'), posts: rows, pagination: pageMeta(count, page, limit) });
  } catch (error) {
    return next(error);
  }
}

async function loadPostForRender(slug) {
  const row = await Post.findOne({
    where: { slug, status: 'published', post_type: 'post' },
    include: [...publishedPostInclude]
  });
  if (!row) return null;
  const allComments = await Comment.findAll({
    where: { post_id: row.id, status: 'approved' },
    order: [['created_at', 'ASC']]
  });
  const { buildCommentTree, countComments } = require('../../utils/commentHelper');
  row.setDataValue('comments', buildCommentTree(allComments));
  row.setDataValue('commentCount', countComments(buildCommentTree(allComments)));
  const [relatedPosts, prevPost, nextPost] = await Promise.all([
    Post.findAll({
      where: {
        id: { [Op.ne]: row.id },
        status: 'published',
        post_type: 'post',
        ...(row.category_id ? { category_id: row.category_id } : {})
      },
      include: publishedPostInclude,
      limit: 3,
      order: [['published_at', 'DESC']]
    }),
    Post.findOne({
      where: { status: 'published', post_type: 'post', published_at: { [Op.lt]: row.published_at || row.created_at } },
      order: [['published_at', 'DESC']],
      attributes: ['title', 'slug']
    }),
    Post.findOne({
      where: { status: 'published', post_type: 'post', published_at: { [Op.gt]: row.published_at || row.created_at } },
      order: [['published_at', 'ASC']],
      attributes: ['title', 'slug']
    })
  ]);
  return { row, relatedPosts, prevPost, nextPost };
}

async function post(req, res, next) {
  try {
    const loaded = await loadPostForRender(req.params.slug);
    if (!loaded) return res.status(404).render('public/error', { title: 'Post Not Found', code: 404, message: 'This post could not be found or is no longer published.' });
    const { row, relatedPosts, prevPost, nextPost } = loaded;
    await row.increment('views_count');
    return renderPublic(res, 'post', {
      title: row.title,
      seo: meta(row.seo_title || row.title, row.seo_description || row.excerpt, row.og_image || row.featured_image),
      post: row,
      relatedPosts,
      prevPost,
      nextPost,
      commentTree: row.comments || [],
      commentCount: row.commentCount || 0,
      schema: postSchema(row, `${req.protocol}://${req.get('host')}${req.originalUrl}`)
    }, { before: 'beforePostRender', after: 'afterPostRender', template: 'post' }, {
      postType: row.post_type || 'post',
      slug: row.slug
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
      where: { category_id: categoryRow.id, status: 'published', post_type: 'post' },
      include: publishedPostInclude,
      distinct: true,
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    const translatedCategory = await translateCategory(res.locals.translationEngine, categoryRow);
    return renderPublic(res, 'category', {
      title: translatedCategory.name,
      seo: meta(translatedCategory.name, translatedCategory.description),
      heading: translatedCategory.name,
      posts: rows,
      pagination: pageMeta(count, page, limit)
    }, null, { slug: categoryRow.slug });
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
      where: { status: 'published', post_type: 'post' },
      include: [...publishedPostInclude, { model: Tag, where: { id: tagRow.id } }],
      distinct: true,
      limit,
      offset,
      order: [['published_at', 'DESC']]
    });
    const translatedTag = await translateTag(res.locals.translationEngine, tagRow);
    return renderPublic(res, 'tag', {
      title: translatedTag.name,
      seo: meta(translatedTag.name, translatedTag.description),
      heading: translatedTag.name,
      posts: rows,
      pagination: pageMeta(count, page, limit)
    }, null, { slug: tagRow.slug });
  } catch (error) {
    return next(error);
  }
}

async function page(req, res, next) {
  try {
    const row = await Page.findOne({ where: { slug: req.params.slug, status: 'published' } });
    if (!row) return res.status(404).render('public/error', { title: 'Page Not Found', code: 404, message: 'This page could not be found.' });
    return renderPublic(res, 'page', {
      title: row.title,
      seo: meta(row.seo_title || row.title, row.seo_description, row.og_image || row.featured_image),
      page: row
    }, { before: 'beforePageRender', after: 'afterPageRender', template: 'page' }, { slug: row.slug });
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
          post_type: 'post',
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

    return renderPublic(res, 'search', {
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
      name: '',
      email: req.query.email || '',
      phone: '',
      subject: req.query.subject || '',
      message: ''
    };
    return renderPublic(res, 'contact', { title: 'Contact', seo: meta('Contact'), prefill, fieldErrors: {} });
  } catch (error) {
    return next(error);
  }
}

async function submitContact(req, res, next) {
  try {
    const prefill = {
      name: req.body.name || '',
      email: req.body.email || '',
      phone: req.body.phone || '',
      subject: req.body.subject || '',
      message: req.body.message || ''
    };
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return renderPublic(res, 'contact', {
        title: 'Contact',
        seo: meta('Contact'),
        prefill,
        fieldErrors: errors.mapped()
      });
    }

    const messagePayload = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      subject: req.body.subject,
      content: sanitizeHtml(req.body.message || '', { allowedTags: [], allowedAttributes: {} })
    };
    const allowed = await pluginLoader.applyFilters('beforeContactSubmit', messagePayload, { req, res });
    if (!allowed) {
      return renderPublic(res, 'contact', {
        title: 'Contact',
        seo: meta('Contact'),
        prefill,
        formError: 'Your message was flagged as spam.'
      });
    }

    await ContactMessage.create({
      name: allowed.name,
      email: allowed.email,
      phone: allowed.phone,
      subject: allowed.subject,
      message: allowed.content
    });
    req.flash('success', 'Thanks. Your message has been sent.');
    return res.redirect('/contact');
  } catch (error) {
    return next(error);
  }
}

async function comment(req, res, next) {
  try {
    const postRow = await Post.findByPk(req.params.id);
    if (!postRow || !postRow.allow_comments) {
      req.flash('error', 'Comments are closed.');
      return res.redirect('back');
    }

    const commentPrefill = {
      name: req.body.name || '',
      email: req.body.email || '',
      website: req.body.website || '',
      content: req.body.content || ''
    };
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const loaded = await loadPostForRender(postRow.slug);
      if (!loaded) return res.redirect('back');
      const { row, relatedPosts, prevPost, nextPost } = loaded;
      return renderPublic(res, 'post', {
        title: row.title,
        seo: meta(row.seo_title || row.title, row.seo_description || row.excerpt, row.og_image || row.featured_image),
        post: row,
        relatedPosts,
        prevPost,
        nextPost,
        commentPrefill,
        fieldErrors: errors.mapped(),
        schema: postSchema(row, `${req.protocol}://${req.get('host')}/post/${row.slug}`)
      }, { before: 'beforePostRender', after: 'afterPostRender', template: 'post' });
    }

    const commentPayload = {
      post_id: postRow.id,
      parent_id: req.body.parent_id ? Number(req.body.parent_id) : null,
      name: req.body.name,
      email: req.body.email,
      website: req.body.website,
      content: sanitizeHtml(req.body.content || '', { allowedTags: [], allowedAttributes: {} }),
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
      status: 'pending'
    };
    const allowed = await pluginLoader.applyFilters('beforeCommentSave', commentPayload, { req, res, post: postRow });
    if (!allowed) {
      const loaded = await loadPostForRender(postRow.slug);
      if (!loaded) return res.redirect('back');
      const { row, relatedPosts, prevPost, nextPost } = loaded;
      return renderPublic(res, 'post', {
        title: row.title,
        seo: meta(row.seo_title || row.title, row.seo_description || row.excerpt, row.og_image || row.featured_image),
        post: row,
        relatedPosts,
        prevPost,
        nextPost,
        commentPrefill,
        formError: 'Your comment was flagged as spam.',
        schema: postSchema(row, `${req.protocol}://${req.get('host')}/post/${row.slug}`)
      }, { before: 'beforePostRender', after: 'afterPostRender', template: 'post' });
    }
    const savedComment = await Comment.create(allowed);
    await pluginLoader.doAction('afterCommentSave', savedComment, { req, res, post: postRow });
    try {
      const { sendCommentNotification } = require('../../utils/mailer');
      await sendCommentNotification({ post: postRow, comment: savedComment });
    } catch {
      // Email delivery must not block comment submission.
    }
    req.flash('success', 'Comment submitted for moderation.');
    return res.redirect(`/post/${postRow.slug}#comments`);
  } catch (error) {
    return next(error);
  }
}

async function sitemap(req, res, next) {
  try {
    const [posts, pages] = await Promise.all([
      Post.findAll({ where: { status: 'published', post_type: 'post' }, attributes: ['slug', 'updated_at'] }),
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
