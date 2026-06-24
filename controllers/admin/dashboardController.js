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
    const [posts, pages, users, categories, media, recentPosts, recentLogins, securityAlerts, messages, comments] =
      await Promise.all([
        Post.count(),
        Page.count(),
        User.count(),
        Category.count(),
        Media.count(),
        Post.findAll({ limit: 8, order: [['created_at', 'DESC']] }),
        LoginAttempt.findAll({ limit: 8, order: [['created_at', 'DESC']] }),
        LoginAttempt.count({ where: { success: false } }),
        ContactMessage.count({ where: { status: 'unread' } }),
        Comment.count({ where: { status: 'pending' } })
      ]);

    return res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: { posts, pages, users, categories, media, messages, comments },
      recentPosts,
      recentLogins,
      securityAlerts
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { dashboard };
