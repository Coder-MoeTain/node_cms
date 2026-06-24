const {
  Post,
  Page,
  User,
  Category,
  Media,
  LoginAttempt,
  ActivityLog,
  ContactMessage,
  Comment
} = require('../../models');

async function dashboard(req, res, next) {
  try {
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
      messages
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
      ContactMessage.count({ where: { status: 'unread' } })
    ]);

    return res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: { posts, publishedPosts, draftPosts, pages, categories, users, media, comments },
      recentPosts,
      recentComments,
      recentLogins,
      recentActivity,
      messages,
      securityAlerts
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { dashboard };
