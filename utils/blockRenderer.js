const sanitizeHtml = require('sanitize-html');
const { parseShortcodes } = require('./shortcodeParser');

const textSanitize = { allowedTags: [], allowedAttributes: {} };

function escapeText(value) {
  return sanitizeHtml(String(value || ''), textSanitize);
}

function renderBlock(block, context = {}) {
  if (!block || !block.type) return '';
  const attrs = block.attrs || {};
  switch (block.type) {
    case 'paragraph':
      return `<p>${escapeText(block.content)}</p>`;
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(attrs.level) || 2));
      return `<h${level}>${escapeText(block.content)}</h${level}>`;
    }
    case 'image':
      return attrs.src
        ? `<figure class="np-block-image"><img src="${escapeText(attrs.src)}" alt="${escapeText(attrs.alt || '')}"></figure>`
        : '';
    case 'quote':
      return `<blockquote class="np-block-quote"><p>${escapeText(block.content)}</p>${attrs.cite ? `<cite>${escapeText(attrs.cite)}</cite>` : ''}</blockquote>`;
    case 'button':
      return `<p><a class="btn btn-primary" href="${escapeText(attrs.url || '#')}">${escapeText(attrs.label || block.content || 'Click')}</a></p>`;
    case 'list': {
      const tag = attrs.ordered ? 'ol' : 'ul';
      const items = (block.items || []).map((item) => `<li>${escapeText(item)}</li>`).join('');
      return `<${tag}>${items}</${tag}>`;
    }
    case 'columns': {
      const cols = attrs.columns || block.columns || [];
      const inner = cols.map((col) => `<div class="np-block-column">${escapeText(col)}</div>`).join('');
      return `<div class="np-block-columns np-block-columns-${cols.length || 2}">${inner}</div>`;
    }
    case 'gallery': {
      const images = attrs.images || block.images || [];
      const items = images.map((img) => {
        const src = typeof img === 'string' ? img : img.src;
        const alt = typeof img === 'string' ? '' : (img.alt || '');
        return src ? `<figure><img src="${escapeText(src)}" alt="${escapeText(alt)}"></figure>` : '';
      }).join('');
      return `<div class="np-block-gallery">${items}</div>`;
    }
    case 'cover':
      return attrs.src
        ? `<div class="np-block-cover" style="background-image:url('${escapeText(attrs.src)}')"><div class="np-block-cover-inner"><h2>${escapeText(attrs.title || block.content || '')}</h2></div></div>`
        : `<div class="np-block-cover"><div class="np-block-cover-inner">${escapeText(block.content || '')}</div></div>`;
    case 'embed': {
      const url = attrs.url || block.content || '';
      if (!url) return '';
      if (/youtube\.com|youtu\.be/.test(url)) {
        const id = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1];
        return id ? `<div class="np-block-embed"><iframe src="https://www.youtube.com/embed/${escapeText(id)}" allowfullscreen loading="lazy"></iframe></div>` : '';
      }
      return `<div class="np-block-embed"><a href="${escapeText(url)}">${escapeText(url)}</a></div>`;
    }
    case 'separator':
      return '<hr class="np-block-separator">';
    case 'code':
      return `<pre class="np-block-code"><code>${escapeText(block.content)}</code></pre>`;
    case 'video':
      return attrs.src ? `<video class="np-block-video" controls src="${escapeText(attrs.src)}"></video>` : '';
    case 'audio':
      return attrs.src ? `<audio class="np-block-audio" controls src="${escapeText(attrs.src)}"></audio>` : '';
    case 'file':
      return attrs.url
        ? `<p class="np-block-file"><a href="${escapeText(attrs.url)}" download>${escapeText(attrs.label || 'Download file')}</a></p>`
        : '';
    case 'table': {
      const rows = block.rows || attrs.rows || [];
      const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeText(cell)}</td>`).join('')}</tr>`).join('');
      return `<table class="np-block-table"><tbody>${body}</tbody></table>`;
    }
    case 'html':
      return sanitizeHtml(block.content || '', {
        allowedTags: sanitizeHtml.defaults.allowedTags,
        allowedAttributes: sanitizeHtml.defaults.allowedAttributes
      });
    case 'spacer':
      return `<div class="np-block-spacer" style="height:${Number(attrs.height) || 24}px"></div>`;
    default:
      return block.content ? `<div class="np-block np-block-${block.type}">${escapeText(block.content)}</div>` : '';
  }
}

function renderBlocks(json, context = {}) {
  let blocks = [];
  try {
    blocks = typeof json === 'string' ? JSON.parse(json) : json;
    if (!Array.isArray(blocks)) return '';
  } catch {
    return '';
  }
  const html = blocks.map((block) => renderBlock(block, context)).join('\n');
  return parseShortcodes(html, context);
}

function validateBlockSchema(json) {
  let blocks;
  try {
    blocks = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return { valid: false, error: 'Invalid JSON' };
  }
  if (!Array.isArray(blocks)) return { valid: false, error: 'Blocks must be an array' };
  for (const block of blocks) {
    if (!block.type || typeof block.type !== 'string') {
      return { valid: false, error: 'Each block requires a type string' };
    }
  }
  return { valid: true, blocks };
}

const BLOCK_TYPES = [
  'paragraph', 'heading', 'image', 'quote', 'button', 'list', 'columns', 'gallery',
  'cover', 'embed', 'separator', 'code', 'video', 'audio', 'file', 'table', 'html', 'spacer'
];

module.exports = { renderBlocks, renderBlock, validateBlockSchema, BLOCK_TYPES };
