const appConfig = require('../config/app');

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cdata(value = '') {
  return `<![CDATA[${String(value).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function mapStatusToWp(status) {
  if (status === 'published') return 'publish';
  if (status === 'pending') return 'pending';
  if (status === 'private') return 'private';
  return 'draft';
}

function absoluteMediaUrl(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath)) return filePath;
  const base = String(appConfig.url || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
}

function buildCategoryTags(categories = [], tags = []) {
  const lines = [];
  for (const category of categories) {
    if (!category?.slug) continue;
    lines.push(`      <category domain="category" nicename="${escapeXml(category.slug)}">${cdata(category.name || category.slug)}</category>`);
  }
  for (const tag of tags) {
    if (!tag?.slug) continue;
    lines.push(`      <category domain="post_tag" nicename="${escapeXml(tag.slug)}">${cdata(tag.name || tag.slug)}</category>`);
  }
  return lines.join('\n');
}

function buildPostMeta(key, value) {
  return `      <wp:postmeta>
        <wp:meta_key>${escapeXml(key)}</wp:meta_key>
        <wp:meta_value>${cdata(typeof value === 'string' ? value : JSON.stringify(value))}</wp:meta_value>
      </wp:postmeta>`;
}

function buildContentItem(record, postType, categories = [], tags = [], meta = []) {
  const slug = record.slug || 'item';
  const link = postType === 'page'
    ? `${appConfig.url}/page/${slug}`
    : `${appConfig.url}/post/${slug}`;
  const categoryXml = buildCategoryTags(categories, tags);
  const metaXml = meta.map((m) => buildPostMeta(m.key, m.value)).join('\n');
  return `    <item>
      <title>${cdata(record.title || slug)}</title>
      <link>${escapeXml(link)}</link>
      <pubDate>${cdata(record.published_at || record.updated_at || new Date().toISOString())}</pubDate>
      <dc:creator>${cdata('admin')}</dc:creator>
      <content:encoded>${cdata(record.content || '')}</content:encoded>
      <excerpt:encoded>${cdata(record.excerpt || '')}</excerpt:encoded>
      <wp:post_type>${postType}</wp:post_type>
      <wp:status>${mapStatusToWp(record.status)}</wp:status>
      <wp:post_name>${escapeXml(slug)}</wp:post_name>
${categoryXml ? `${categoryXml}\n` : ''}${metaXml ? `${metaXml}\n` : ''}    </item>`;
}

function buildAttachmentItem(media) {
  const url = absoluteMediaUrl(media.file_path);
  const filename = media.filename || media.original_name || 'attachment';
  return `    <item>
      <title>${cdata(media.original_name || filename)}</title>
      <link>${escapeXml(url)}</link>
      <wp:post_type>attachment</wp:post_type>
      <wp:status>inherit</wp:status>
      <wp:post_name>${escapeXml(filename)}</wp:post_name>
      <wp:attachment_url>${escapeXml(url)}</wp:attachment_url>
      <wp:post_mime_type>${escapeXml(media.mime_type || 'application/octet-stream')}</wp:post_mime_type>
    </item>`;
}

function buildNavMenuTerm(menu) {
  return `    <wp:term>
      <wp:term_id>${menu.id || 0}</wp:term_id>
      <wp:term_taxonomy>nav_menu</wp:term_taxonomy>
      <wp:term_slug>${escapeXml(menu.slug || menu.name)}</wp:term_slug>
      <wp:term_name>${cdata(menu.name || menu.slug)}</wp:term_name>
    </wp:term>`;
}

function buildNavMenuItem(item, menu) {
  const title = item.title || 'Menu Item';
  const url = item.url || '#';
  return `    <item>
      <title>${cdata(title)}</title>
      <link>${escapeXml(url)}</link>
      <wp:post_type>nav_menu_item</wp:post_type>
      <wp:status>publish</wp:status>
      <wp:post_name>${escapeXml(String(item.id || title).replace(/\s+/g, '-').toLowerCase())}</wp:post_name>
      <category domain="nav_menu" nicename="${escapeXml(menu.slug || menu.name)}">${cdata(menu.name || menu.slug)}</category>
      <wp:postmeta><wp:meta_key>_menu_item_type</wp:meta_key><wp:meta_value>${cdata(item.item_type || 'custom')}</wp:meta_value></wp:postmeta>
      <wp:postmeta><wp:meta_key>_menu_item_url</wp:meta_key><wp:meta_value>${cdata(url)}</wp:meta_value></wp:postmeta>
      <wp:postmeta><wp:meta_key>_menu_item_menu_item_parent</wp:meta_key><wp:meta_value>${cdata(String(item.parent_id || 0))}</wp:meta_value></wp:postmeta>
      <wp:postmeta><wp:meta_key>_menu_item_object_id</wp:meta_key><wp:meta_value>${cdata(String(item.reference_id || 0))}</wp:meta_value></wp:postmeta>
      <wp:postmeta><wp:meta_key>np_menu_order</wp:meta_key><wp:meta_value>${cdata(String(item.display_order || 0))}</wp:meta_value></wp:postmeta>
    </item>`;
}

function buildExtensionsBlock(payload) {
  const extension = {
    custom_post_types: payload.custom_post_types || [],
    custom_posts: payload.custom_posts || [],
    field_groups: payload.field_groups || [],
    taxonomies: payload.taxonomies || [],
    widget_areas: payload.widget_areas || [],
    post_taxonomy_terms: payload.post_taxonomy_terms || []
  };
  return `    <np:extensions xmlns:np="https://nodepress.dev/export/1.0">
      <np:data type="application/json">${cdata(JSON.stringify(extension))}</np:data>
    </np:extensions>`;
}

function exportPayloadToWxr(payload, options = {}) {
  const siteTitle = options.siteTitle || 'NodePress Export';
  const siteUrl = options.siteUrl || appConfig.url || 'http://localhost:3000';
  const posts = payload.posts || [];
  const pages = payload.pages || [];
  const media = (payload.media || []).filter((row) => row.file_path && !/^https?:\/\//i.test(row.file_path));
  const categories = payload.categories || [];
  const tags = payload.tags || [];
  const menus = payload.menus || [];
  const customPosts = payload.custom_posts || [];

  const items = [
    ...posts.map((row) => buildContentItem(row, 'post', categories, tags, row.custom_fields_meta || [])),
    ...pages.map((row) => buildContentItem(row, 'page', [], [], row.custom_fields_meta || [])),
    ...customPosts.map((row) => buildContentItem(row, row.post_type || 'custom', [], [], row.custom_fields_meta || [])),
    ...media.map((row) => buildAttachmentItem(row))
  ];

  const menuTerms = menus.map((menu) => buildNavMenuTerm(menu)).join('\n');
  const menuItems = menus.flatMap((menu) => (menu.items || []).map((item) => buildNavMenuItem(item, menu))).join('\n');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
  xmlns:np="https://nodepress.dev/export/1.0">
  <channel>
    <title>${cdata(siteTitle)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${cdata('Exported from NodePress CMS')}</description>
    <wp:wxr_version>1.2</wp:wxr_version>
    <generator>NodePress CMS WXR Exporter</generator>
${menuTerms ? `${menuTerms}\n` : ''}${items.join('\n')}
${menuItems ? `\n${menuItems}` : ''}
${buildExtensionsBlock(payload)}
  </channel>
</rss>
`;
}

async function exportSiteToWxr(exportFn, options = {}) {
  const payload = await exportFn({ includeMedia: options.includeMedia !== false, siteId: options.siteId });
  return exportPayloadToWxr(payload, options);
}

module.exports = {
  escapeXml,
  mapStatusToWp,
  exportPayloadToWxr,
  exportSiteToWxr,
  buildExtensionsBlock
};
