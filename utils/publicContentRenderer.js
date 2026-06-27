const { renderBlocks } = require('./blockRenderer');
const { parseShortcodes } = require('./shortcodeParser');

function resolvePublicContent(record, context = {}) {
  if (!record) return '';
  const format = record.content_format || 'classic';
  let html = record.content || '';
  if (format === 'block' && record.block_content_json) {
    html = renderBlocks(record.block_content_json, context);
  }
  return parseShortcodes(html, context);
}

module.exports = { resolvePublicContent };
