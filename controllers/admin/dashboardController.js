const fs = require('fs');
const path = require('path');
const {
  Post,
  Page,
  User,
  Category,
  Media,
  LoginAttempt,
  ActivityLog,
  ContactMessage,
  Comment,
  ThemeSetting,
  WafSetting
} = require('../../models');
const { createUniqueSlug } = require('../../utils/slugGenerator');

async function dashboard(req, res, next) {
  try {
    const uploadsDir = path.join(__dirname, '../../public/uploads');
    const [
      posts,
      publishedPosts,
      draftPosts,
      pages,
      users,
      categories,
      media,
      comments,
      recentPosts,
      recentComments,
      recentLogins,
      recentActivity,
      securityAlerts,
      messages,
      activeTheme,
      wafModeSetting
    ] = await Promise.all([
      Post.count(),
      Post.count({ where: { status: 'published' } }),
      Post.count({ where: { status: 'draft' } }),
      Page.count(),
      User.count(),
      Category.count(),
      Media.count(),
      Comment.count(),
      Post.findAll({ limit: 8, order: [['created_at', 'DESC']] }),
      Comment.findAll({ limit: 8, include: [Post], order: [['created_at', 'DESC']] }),
      LoginAttempt.findAll({ limit: 8, order: [['created_at', 'DESC']] }),
      ActivityLog.findAll({ limit: 8, include: [User], order: [['created_at', 'DESC']] }),
      LoginAttempt.count({ where: { success: false } }),
      ContactMessage.count({ where: { status: 'unread' } }),
      ThemeSetting.findOne({ where: { active: true } }),
      WafSetting.findOne({ where: { setting_key: 'waf_mode' } })
    ]);

    let uploadsWritable = false;
    try {
      fs.accessSync(uploadsDir, fs.constants.W_OK);
      uploadsWritable = true;
    } catch (error) {
      uploadsWritable = false;
    }

    return res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: { posts, publishedPosts, draftPosts, pages, categories, users, media, comments },
      recentPosts,
      recentComments,
      recentLogins,
      recentActivity,
      messages,
      securityAlerts,
      siteHealth: {
        env: process.env.NODE_ENV || 'development',
        database: true,
        uploadsWritable,
        wafMode: wafModeSetting?.setting_value || 'monitor',
        activeTheme: activeTheme?.theme_name || 'classic-blog'
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function quickDraft(req, res, next) {
  try {
    const title = String(req.body.title || '').trim();
    const content = String(req.body.content || '').trim();
    if (!title) {
      req.flash('error', 'Quick draft requires a title.');
      return res.redirect('/admin');
    }
    const slug = await createUniqueSlug(Post, title, 'post');
    await Post.create({
      title,
      slug,
      content: content || '<p></p>',
      status: 'draft',
      author_id: req.session.user.id,
      allow_comments: true
    });
    req.flash('success', 'Draft saved.');
    return res.redirect('/admin/posts');
  } catch (error) {
    return next(error);
  }
}

module.exports = { dashboard, quickDraft };
