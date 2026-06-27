const { renderBlocks } = require('./blockRenderer');

const TEMPLATE_TYPES = {
  header: {
    label: 'Header',
    icon: 'bi-layout-text-window',
    description: 'Top-of-page layout with navigation and branding blocks.',
    group: 'layout'
  },
  footer: {
    label: 'Footer',
    icon: 'bi-layout-text-window-reverse',
    description: 'Bottom-of-page layout with links and copyright blocks.',
    group: 'layout'
  },
  homepage: {
    label: 'Homepage',
    icon: 'bi-house-door',
    description: 'Front page block layout when no static front page is set.',
    group: 'content'
  },
  'single-post': {
    label: 'Single Post',
    icon: 'bi-file-earmark-text',
    description: 'Default wrapper blocks for blog post views.',
    group: 'content'
  },
  page: {
    label: 'Page',
    icon: 'bi-file-earmark',
    description: 'Default wrapper blocks for static pages.',
    group: 'content'
  },
  404: {
    label: '404 Not Found',
    icon: 'bi-exclamation-triangle',
    description: 'Content shown when a URL cannot be found.',
    group: 'system'
  }
};

const PART_TYPES = {
  header: {
    label: 'Header',
    icon: 'bi-layout-text-window',
    description: 'Reusable header region (logo, nav, utilities).'
  },
  footer: {
    label: 'Footer',
    icon: 'bi-layout-text-window-reverse',
    description: 'Reusable footer region (links, social, legal).'
  },
  sidebar: {
    label: 'Sidebar',
    icon: 'bi-layout-sidebar',
    description: 'Optional sidebar region for archive and single views.'
  }
};

const DEFAULT_TEMPLATE_TYPES = ['header', 'footer', 'homepage', 'single-post', 'page', '404'];
const DEFAULT_PART_TYPES = ['header', 'footer', 'sidebar'];

function getTemplateTypeMeta(type) {
  return TEMPLATE_TYPES[type] || {
    label: type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: 'bi-file-earmark-code',
    description: 'Custom site template.',
    group: 'custom'
  };
}

function getPartTypeMeta(type) {
  return PART_TYPES[type] || {
    label: type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: 'bi-puzzle',
    description: 'Custom template part.'
  };
}

function countBlocks(json) {
  try {
    const blocks = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    return Array.isArray(blocks) ? blocks.length : 0;
  } catch {
    return 0;
  }
}

function parseBlocks(json) {
  try {
    const blocks = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    return Array.isArray(blocks) ? blocks : [];
  } catch {
    return [];
  }
}

function enrichTemplate(record) {
  const plain = record.toJSON ? record.toJSON() : { ...record };
  const meta = getTemplateTypeMeta(plain.template_type);
  return {
    ...plain,
    typeMeta: meta,
    blockCount: countBlocks(plain.block_content_json),
    previewHtml: renderBlocks(plain.block_content_json || '[]')
  };
}

function enrichPart(record) {
  const plain = record.toJSON ? record.toJSON() : { ...record };
  const meta = getPartTypeMeta(plain.part_type);
  return {
    ...plain,
    typeMeta: meta,
    blockCount: countBlocks(plain.block_content_json),
    previewHtml: renderBlocks(plain.block_content_json || '[]')
  };
}

function defaultBlockContent(label) {
  return JSON.stringify([
    { type: 'heading', content: label, attrs: { level: 2 } },
    { type: 'paragraph', content: `Edit this ${label.toLowerCase()} template with blocks.` }
  ]);
}

function titleCaseSlug(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = {
  TEMPLATE_TYPES,
  PART_TYPES,
  DEFAULT_TEMPLATE_TYPES,
  DEFAULT_PART_TYPES,
  getTemplateTypeMeta,
  getPartTypeMeta,
  countBlocks,
  parseBlocks,
  enrichTemplate,
  enrichPart,
  defaultBlockContent,
  titleCaseSlug
};
