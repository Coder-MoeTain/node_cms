const { Op } = require('sequelize');
const { User, Post, Comment, ContactMessage, Page, Media, SiteSetting } = require('../models');

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US');
}

async function incrementPortalVisitCount() {
  const [row] = await SiteSetting.findOrCreate({
    where: { key: 'portal_visit_count' },
    defaults: { value: '0', group: 'portal_stats' }
  });
  const next = Number(row.value || 0) + 1;
  row.value = String(next);
  await row.save();
  return next;
}

async function getPortalStats(siteSettings = {}) {
  const now = new Date();

  const [
    registeredUsers,
    postViewSum,
    discussions,
    pollMessages,
    pollPosts,
    publishedBlogs,
    upcomingEvents,
    appPages,
    appMedia
  ] = await Promise.all([
    User.count({ where: { status: 'active' } }),
    Post.sum('views_count', { where: { status: 'published' } }),
    Comment.count({ where: { status: 'approved' } }),
    ContactMessage.count({
      where: {
        [Op.or]: [
          { subject: { [Op.like]: '%poll%' } },
          { subject: { [Op.like]: '%survey%' } }
        ]
      }
    }),
    Post.count({
      where: {
        status: 'published',
        [Op.or]: [
          { title: { [Op.like]: '%poll%' } },
          { title: { [Op.like]: '%survey%' } },
          { slug: { [Op.like]: '%poll%' } },
          { slug: { [Op.like]: '%survey%' } }
        ]
      }
    }),
    Post.count({ where: { status: 'published' } }),
    Post.count({
      where: {
        status: { [Op.in]: ['published', 'scheduled'] },
        published_at: { [Op.gte]: now }
      }
    }),
    Page.count({
      where: {
        status: 'published',
        [Op.or]: [
          { slug: { [Op.like]: '%app%' } },
          { title: { [Op.like]: '%mobile app%' } },
          { title: { [Op.like]: '%application%' } }
        ]
      }
    }),
    Media.count({
      where: {
        [Op.or]: [
          { mime_type: { [Op.like]: '%apk%' } },
          { original_name: { [Op.like]: '%.apk' } },
          { file_path: { [Op.like]: '%/apps/%' } }
        ]
      }
    })
  ]);

  const portalVisits = Number(siteSettings.portal_visit_count || 0);
  const storeLinks = [siteSettings.app_store_link, siteSettings.play_store_link].filter(
    (url) => url && !String(url).includes('/contact')
  ).length;
  const visitors = Number(postViewSum || 0) + portalVisits;
  const polls = Number(pollMessages || 0) + Number(pollPosts || 0);
  const mobileApps = Number(storeLinks || 0) + Number(appPages || 0) + Number(appMedia || 0);

  const items = [
    {
      key: 'users',
      label: 'Registered users',
      count: registeredUsers,
      value: formatCount(registeredUsers),
      url: '/contact?subject=Citizen+registration+request'
    },
    {
      key: 'visitors',
      label: 'Visitors',
      count: visitors,
      value: formatCount(visitors),
      url: '/blog'
    },
    {
      key: 'discussions',
      label: 'Discussions',
      count: discussions,
      value: formatCount(discussions),
      url: '/blog'
    },
    {
      key: 'polls',
      label: 'Polls & Survey',
      count: polls,
      value: formatCount(polls),
      url: '/search?q=poll'
    },
    {
      key: 'blogs',
      label: 'Blogs',
      count: publishedBlogs,
      value: formatCount(publishedBlogs),
      url: '/blog'
    },
    {
      key: 'events',
      label: 'Upcoming Events',
      count: upcomingEvents,
      value: formatCount(upcomingEvents),
      url: '/search?q=event'
    },
    {
      key: 'apps',
      label: 'Mobile App Gallery',
      count: mobileApps,
      value: formatCount(mobileApps),
      url: '#portal-mobile-app'
    }
  ];

  return {
    items,
    totals: items.reduce((map, item) => ({ ...map, [item.key]: item.count }), {}),
    visitors,
    registeredUsers,
    discussions,
    polls,
    blogs: publishedBlogs,
    events: upcomingEvents,
    apps: mobileApps
  };
}

module.exports = {
  formatCount,
  getPortalStats,
  incrementPortalVisitCount
};
