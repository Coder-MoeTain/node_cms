const { createSlug } = require('./slugGenerator');

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(raw) {
  const lines = String(raw || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});
  });
  return { headers, rows };
}

function csvToImportPayload(raw, type = 'posts') {
  const { headers, rows } = parseCsv(raw);
  if (!headers.length) throw new Error('CSV file is empty or invalid.');
  if (type === 'pages') {
    return {
      version: '1.1',
      exported_at: new Date().toISOString(),
      source: 'csv',
      pages: rows.map((row) => ({
        title: row.title || row.slug || 'Untitled',
        slug: row.slug || createSlug(row.title, 'page'),
        status: row.status || 'draft',
        parent_id: row.parent_id ? Number(row.parent_id) : null,
        menu_order: Number(row.menu_order) || 0,
        content: row.content || '<p></p>',
        excerpt: row.excerpt || ''
      }))
    };
  }
  return {
    version: '1.1',
    exported_at: new Date().toISOString(),
    source: 'csv',
    posts: rows.map((row) => ({
      title: row.title || row.slug || 'Untitled',
      slug: row.slug || createSlug(row.title, 'post'),
      status: row.status || 'draft',
      post_type: row.post_type || 'post',
      content: row.content || '<p></p>',
      excerpt: row.excerpt || '',
      category_id: row.category_id ? Number(row.category_id) : null
    }))
  };
}

function isPostsCsv(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  const first = trimmed.split(/\r?\n/)[0] || '';
  return first.includes(',') && /title/i.test(first) && /slug/i.test(first);
}

module.exports = { parseCsv, csvToImportPayload, isPostsCsv };
