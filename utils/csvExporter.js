function csvEscape(value = '') {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => csvEscape(row[key])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function exportPostsToCsv(posts = []) {
  const headers = ['id', 'title', 'slug', 'status', 'post_type', 'excerpt', 'published_at', 'category_id'];
  const rows = posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    post_type: p.post_type || 'post',
    excerpt: p.excerpt || '',
    published_at: p.published_at || '',
    category_id: p.category_id || ''
  }));
  return rowsToCsv(headers, rows);
}

function exportPagesToCsv(pages = []) {
  const headers = ['id', 'title', 'slug', 'status', 'parent_id', 'menu_order', 'published_at'];
  const rows = pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    parent_id: p.parent_id || '',
    menu_order: p.menu_order || 0,
    published_at: p.published_at || ''
  }));
  return rowsToCsv(headers, rows);
}

module.exports = { csvEscape, rowsToCsv, exportPostsToCsv, exportPagesToCsv };
