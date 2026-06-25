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

module.exports = { renderBlocks, renderBlock, validateBlockSchema };
