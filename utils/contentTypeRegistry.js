const SUPPORT_FLAGS = {
  supports_title: { label: 'Title', icon: 'bi-type', group: 'content' },
  supports_editor: { label: 'Editor', icon: 'bi-pencil-square', group: 'content' },
  supports_excerpt: { label: 'Excerpt', icon: 'bi-text-paragraph', group: 'content' },
  supports_featured_image: { label: 'Featured image', icon: 'bi-image', group: 'content' },
  supports_comments: { label: 'Comments', icon: 'bi-chat-dots', group: 'features' },
  supports_revisions: { label: 'Revisions', icon: 'bi-clock-history', group: 'features' },
  supports_custom_fields: { label: 'Custom fields', icon: 'bi-input-cursor-text', group: 'features' },
  has_archive: { label: 'Archive', icon: 'bi-archive', group: 'visibility' },
  show_in_menu: { label: 'Admin menu', icon: 'bi-list', group: 'visibility' },
  show_in_api: { label: 'REST API', icon: 'bi-braces', group: 'visibility' }
};

const ICON_PRESETS = [
  'bi-newspaper', 'bi-calendar-event', 'bi-briefcase', 'bi-megaphone',
  'bi-file-earmark-text', 'bi-file-earmark', 'bi-book', 'bi-journal',
  'bi-camera', 'bi-film', 'bi-music-note', 'bi-cart',
  'bi-building', 'bi-people', 'bi-heart-pulse', 'bi-mortarboard',
  'bi-globe', 'bi-pin-map', 'bi-tag', 'bi-star'
];

const DEFAULT_TYPES = [
  {
    name: 'News',
    slug: 'news',
    description: 'Announcements, press releases, and updates.',
    icon: 'bi-newspaper',
    supports_comments: false
  },
  {
    name: 'Events',
    slug: 'events',
    description: 'Calendar events, workshops, and public meetings.',
    icon: 'bi-calendar-event',
    supports_comments: false
  },
  {
    name: 'Jobs',
    slug: 'jobs',
    description: 'Job openings and career opportunities.',
    icon: 'bi-briefcase',
    supports_excerpt: true,
    supports_comments: false,
    has_archive: true
  }
];

function getEnabledSupports(record) {
  return Object.entries(SUPPORT_FLAGS)
    .filter(([key]) => Boolean(record[key]))
    .map(([key, meta]) => ({ key, ...meta }));
}

function enrichContentType(record, counts = {}) {
  const plain = record.toJSON ? record.toJSON() : { ...record };
  const itemCount = counts.items?.[plain.slug] || 0;
  const publishedCount = counts.published?.[plain.slug] || 0;
  const draftCount = counts.draft?.[plain.slug] || 0;
  const fieldGroupCount = counts.fieldGroups?.[plain.slug] || 0;

  return {
    ...plain,
    itemCount,
    publishedCount,
    draftCount,
    fieldGroupCount,
    supports: getEnabledSupports(plain),
    publicUrl: plain.has_archive && plain.status === 'active' ? `/types/${plain.slug}` : null
  };
}

async function loadContentTypeCounts(models) {
  const { fn, col } = models.sequelize;
  const [itemRows, publishedRows, draftRows, fieldGroupRows] = await Promise.all([
    models.Post.findAll({
      attributes: ['post_type', [fn('COUNT', col('id')), 'count']],
      group: ['post_type'],
      raw: true
    }),
    models.Post.findAll({
      attributes: ['post_type', [fn('COUNT', col('id')), 'count']],
      where: { status: 'published' },
      group: ['post_type'],
      raw: true
    }),
    models.Post.findAll({
      attributes: ['post_type', [fn('COUNT', col('id')), 'count']],
      where: { status: 'draft' },
      group: ['post_type'],
      raw: true
    }),
    models.FieldGroup.findAll({
      attributes: ['location_value', [fn('COUNT', col('id')), 'count']],
      where: { location_type: 'custom_post_type' },
      group: ['location_value'],
      raw: true
    })
  ]);

  const toMap = (rows, key) => Object.fromEntries(rows.map((row) => [row[key], Number(row.count)]));

  return {
    items: toMap(itemRows, 'post_type'),
    published: toMap(publishedRows, 'post_type'),
    draft: toMap(draftRows, 'post_type'),
    fieldGroups: toMap(fieldGroupRows, 'location_value')
  };
}

module.exports = {
  SUPPORT_FLAGS,
  ICON_PRESETS,
  DEFAULT_TYPES,
  getEnabledSupports,
  enrichContentType,
  loadContentTypeCounts
};
