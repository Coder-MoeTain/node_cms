const { Op } = require('sequelize');
const models = require('../models');

async function publishScheduledContent() {
  const now = new Date();
  const where = {
    status: 'scheduled',
    published_at: { [Op.lte]: now }
  };

  const [posts, pages] = await Promise.all([
    models.Post.update(
      { status: 'published', published_at: now },
      { where }
    ),
    models.Page.update(
      { status: 'published', published_at: now },
      { where }
    )
  ]);

  return { posts: posts[0] || 0, pages: pages[0] || 0 };
}

module.exports = { publishScheduledContent };
