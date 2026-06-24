const { Op } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
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
  SiteSetting
} = require('../../models');
const { getPagination, pageMeta } = require('../../utils/pagination');
const { meta, postSchema } = require('../../utils/seoHelper');

const publishedPostInclude = [{ model: Category }, { model: User, as: 'author' }, Tag];

async function home(req, res, next) {
  try {
    const [posts, banners, sliders] = await Promise.all([
      Post.findAll({ where: { status: 'published' }, include: publishedPostInclude, limit: 6, order: [['published_at', 'DESC']] }),
      Banner.findAll({ where: { active: true }, order: [['display_order', 'ASC']] }),
      Slider.findAll({ where: { active: true }, order: [['display_order', 'ASC']] })
    ]);
    return res.render('public/home', { title: 'Home', seo: meta('Home'), posts, banners, sliders });
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
    return res.render('public/blog', { title: 'Blog', seo: meta('Blog'), posts: rows, pagination: pageMeta(count, page, limit) });
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
    if (!row) return res.status(404).render('errors/404', { title: 'Post Not Found' });
    await row.increment('views_count');
    return res.render('public/post', {
      title: row.title,
      seo: meta(row.seo_title || row.title, row.seo_description || row.excerpt, row.og_image || row.featured_image),
      post: row,
      schema: postSchema(row, `${req.protocol}://${req.get('host')}${req.originalUrl}`)
    });
  } catch (error) {
    return next(error);
  }
}

async function category(req, res, next) {
  try {
    const categoryRow = await Category.findOne({ where: { slug: req.params.slug } });
    if (!categoryRow) return res.status(404).render('errors/404', { title: 'Category Not Found' });
    const posts = await Post.findAll({ where: { category_id: categoryRow.id, status: 'published' }, include: publishedPostInclude });
    return res.render('public/archive', { title: categoryRow.name, seo: meta(categoryRow.name, categoryRow.description), heading: categoryRow.name, posts });
  } catch (error) {
    return next(error);
  }
}

async function tag(req, res, next) {
  try {
    const tagRow = await Tag.findOne({ where: { slug: req.params.slug }, include: [{ model: Post, where: { status: 'published' }, required: false, include: publishedPostInclude }] });
    if (!tagRow) return res.status(404).render('errors/404', { title: 'Tag Not Found' });
    return res.render('public/archive', { title: tagRow.name, seo: meta(tagRow.name), heading: `Tag: ${tagRow.name}`, posts: tagRow.Posts || [] });
  } catch (error) {
    return next(error);
  }
}

async function page(req, res, next) {
  try {
    const row = await Page.findOne({ where: { slug: req.params.slug, status: 'published' } });
    if (!row) return res.status(404).render('errors/404', { title: 'Page Not Found' });
    return res.render('public/page', { title: row.title, seo: meta(row.seo_title || row.title, row.seo_description), page: row });
  } catch (error) {
    return next(error);
  }
}

async function search(req, res, next) {
  try {
    const q = req.query.q || '';
    const posts = q
      ? await Post.findAll({
          where: {
            status: 'published',
            [Op.or]: [{ title: { [Op.like]: `%${q}%` } }, { excerpt: { [Op.like]: `%${q}%` } }, { content: { [Op.like]: `%${q}%` } }]
          },
          include: publishedPostInclude
        })
      : [];
    return res.render('public/search', { title: 'Search', seo: meta('Search'), q, posts });
  } catch (error) {
    return next(error);
  }
}

function contact(req, res) {
  res.render('public/contact', { title: 'Contact', seo: meta('Contact') });
}

async function submitContact(req, res, next) {
  try {
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
