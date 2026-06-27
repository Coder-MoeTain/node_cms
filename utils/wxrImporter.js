const { createSlug } = require('./slugGenerator');
const { validateImportPayload, previewImport } = require('./importer');

function isWxrDocument(raw) {
  return typeof raw === 'string' && /wordpress\.org\/export\//i.test(raw);
}

function extractTag(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${escaped}>`, 'i');
  const match = block.match(re);
  if (!match) return '';
  return (match[1] ?? match[2] ?? '').trim();
}

function extractWpCategories(block) {
  const categories = [];
  const tags = [];
  const menus = [];
  const re = /<category\s+domain="([^"]+)"\s+nicename="([^"]+)"[^>]*>([\s\S]*?)<\/category>/gi;
  let match = re.exec(block);
  while (match) {
    const domain = match[1];
    const nicename = match[2];
    const inner = match[3];
    const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    const label = (cdata ? cdata[1] : inner).trim();
    if (domain === 'category') categories.push({ name: label, slug: nicename });
    if (domain === 'post_tag') tags.push({ name: label, slug: nicename });
    if (domain === 'nav_menu') menus.push({ name: label, slug: nicename });
    match = re.exec(block);
  }
  return { categories, tags, menus };
}

function extractPostMeta(block) {
  const meta = [];
  const re = /<wp:postmeta>[\s\S]*?<wp:meta_key>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/wp:meta_key>[\s\S]*?<wp:meta_value>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/wp:meta_value>[\s\S]*?<\/wp:postmeta>/gi;
  let match = re.exec(block);
  while (match) {
    meta.push({ key: (match[1] ?? match[2] ?? '').trim(), value: (match[3] ?? match[4] ?? '').trim() });
    match = re.exec(block);
  }
  return meta;
}

function parseExtensions(raw) {
  const match = raw.match(/<np:data[^>]*>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/np:data>/i);
  if (!match) return null;
  try {
    return JSON.parse((match[1] ?? match[2] ?? '').trim());
  } catch {
    return null;
  }
}

function parseNavMenuTerms(raw) {
  const menus = new Map();
  const blocks = raw.match(/<wp:term>[\s\S]*?<\/wp:term>/gi) || [];
  for (const block of blocks) {
    const taxonomy = extractTag(block, 'wp:term_taxonomy');
    if (taxonomy !== 'nav_menu') continue;
    const slug = extractTag(block, 'wp:term_slug');
    const name = extractTag(block, 'wp:term_name');
    if (slug) menus.set(slug, { name: name || slug, slug, items: [] });
  }
  return menus;
}

function mapWpStatus(status) {
  if (status === 'publish') return 'published';
  if (status === 'pending') return 'pending';
  return 'draft';
}

function parseWxrItems(raw) {
  const items = [];
  const blocks = raw.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const { categories, tags, menus } = extractWpCategories(block);
    const postMeta = extractPostMeta(block);
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      content: extractTag(block, 'content:encoded') || extractTag(block, 'description'),
      excerpt: extractTag(block, 'excerpt:encoded'),
      postType: extractTag(block, 'wp:post_type') || 'post',
      status: extractTag(block, 'wp:status') || 'draft',
      postName: extractTag(block, 'wp:post_name'),
      postDate: extractTag(block, 'wp:post_date'),
      creator: extractTag(block, 'dc:creator'),
      attachmentUrl: extractTag(block, 'wp:attachment_url'),
      mimeType: extractTag(block, 'wp:post_mime_type'),
      categories,
      tags,
      navMenus: menus,
      postMeta
    });
  }
  return items;
}

function inferMediaType(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'document';
  return 'other';
}

function metaValue(postMeta, key) {
  const row = postMeta.find((m) => m.key === key);
  return row ? row.value : '';
}

function wxrItemsToImportPayload(items, raw = '') {
  const posts = [];
  const pages = [];
  const media = [];
  const categories = new Map();
  const tags = new Map();
  const menus = parseNavMenuTerms(raw);
  const customPosts = [];

  for (const item of items) {
    for (const category of item.categories || []) {
      if (category.slug) categories.set(category.slug, category);
    }
    for (const tag of item.tags || []) {
      if (tag.slug) tags.set(tag.slug, tag);
    }

    if (item.postType === 'attachment' && item.attachmentUrl) {
      const filename = item.attachmentUrl.split('/').pop() || item.postName || 'attachment';
      media.push({
        original_name: item.title || filename,
        filename,
        file_path: item.attachmentUrl,
        source_url: item.attachmentUrl,
        mime_type: item.mimeType || 'application/octet-stream',
        file_type: inferMediaType(item.mimeType),
        file_size: 0,
        external: true
      });
      continue;
    }

    if (item.postType === 'nav_menu_item') {
      const menuSlug = item.navMenus?.[0]?.slug;
      if (!menuSlug) continue;
      if (!menus.has(menuSlug)) {
        menus.set(menuSlug, { name: item.navMenus[0].name || menuSlug, slug: menuSlug, items: [] });
      }
      menus.get(menuSlug).items.push({
        title: item.title || 'Item',
        url: metaValue(item.postMeta, '_menu_item_url') || item.link || '#',
        item_type: metaValue(item.postMeta, '_menu_item_type') || 'custom',
        parent_id: Number(metaValue(item.postMeta, '_menu_item_menu_item_parent')) || null,
        reference_id: Number(metaValue(item.postMeta, '_menu_item_object_id')) || null,
        display_order: Number(metaValue(item.postMeta, 'np_menu_order')) || 0,
        target: '_self',
        active: true
      });
      continue;
    }

    if (!['post', 'page'].includes(item.postType) && item.postType !== 'attachment') {
      if (!item.title && !item.postName) continue;
      const slug = item.postName || createSlug(item.title, item.postType);
      customPosts.push({
        title: item.title || slug,
        slug,
        content: item.content || '',
        excerpt: item.excerpt || '',
        status: mapWpStatus(item.status),
        post_type: item.postType,
        custom_fields_meta: item.postMeta.filter((m) => m.key.startsWith('np_field_'))
      });
      continue;
    }

    if (!['post', 'page'].includes(item.postType)) continue;
    if (!item.title && !item.postName) continue;

    const slug = item.postName || createSlug(item.title, item.postType);
    const record = {
      title: item.title || slug,
      slug,
      content: item.content || '',
      excerpt: item.excerpt || '',
      status: mapWpStatus(item.status),
      post_type: item.postType === 'page' ? undefined : 'post',
      custom_fields_meta: item.postMeta.filter((m) => m.key.startsWith('np_field_'))
    };

    if (item.postType === 'page') pages.push(record);
    else posts.push(record);
  }

  const extensions = parseExtensions(raw) || {};
  const payload = {
    version: '1.1',
    exported_at: new Date().toISOString(),
    posts,
    pages,
    custom_posts: extensions.custom_posts?.length ? extensions.custom_posts : customPosts,
    custom_post_types: extensions.custom_post_types || [],
    field_groups: extensions.field_groups || [],
    taxonomies: extensions.taxonomies || [],
    widget_areas: extensions.widget_areas || [],
    post_taxonomy_terms: extensions.post_taxonomy_terms || [],
    media,
    categories: [...categories.values()],
    tags: [...tags.values()],
    menus: [...menus.values()]
  };

  return payload;
}

function parseWxr(raw) {
  if (!isWxrDocument(raw)) {
    throw new Error('Not a WordPress WXR export file.');
  }
  const items = parseWxrItems(raw);
  if (!items.length && !parseExtensions(raw)) {
    throw new Error('WXR file contains no importable items.');
  }
  return wxrItemsToImportPayload(items, raw);
}

async function previewWxrImport(raw) {
  const payload = validateImportPayload(parseWxr(raw));
  const preview = await previewImport(payload);
  return { payload, preview, itemCount: parseWxrItems(raw).length };
}

module.exports = {
  isWxrDocument,
  parseWxrItems,
  parseExtensions,
  wxrItemsToImportPayload,
  parseWxr,
  previewWxrImport
};
