const DEFAULT_PATTERNS = [
  {
    slug: 'hero-intro',
    title: 'Hero intro',
    description: 'Heading, paragraph, and call-to-action button.',
    blocks: [
      { type: 'heading', content: 'Welcome to our site', attrs: { level: 1 } },
      { type: 'paragraph', content: 'Share your mission and key message here.' },
      { type: 'button', attrs: { url: '/contact', label: 'Contact us' } }
    ]
  },
  {
    slug: 'two-column',
    title: 'Two columns',
    description: 'Side-by-side content columns.',
    blocks: [
      { type: 'columns', columns: ['Left column content', 'Right column content'], attrs: { columns: ['Left column content', 'Right column content'] } }
    ]
  },
  {
    slug: 'news-section',
    title: 'Latest news',
    description: 'Heading plus dynamic latest posts block.',
    blocks: [
      { type: 'heading', content: 'Latest news', attrs: { level: 2 } },
      { type: 'latest-posts', attrs: { limit: 5 } }
    ]
  },
  {
    slug: 'contact-cta',
    title: 'Contact CTA',
    description: 'Contact form block with intro text.',
    blocks: [
      { type: 'paragraph', content: 'Have questions? Send us a message.' },
      { type: 'contact-form', attrs: { redirect: '/contact' } }
    ]
  }
];

function listBlockPatterns() {
  return DEFAULT_PATTERNS.map(({ blocks, ...meta }) => meta);
}

function getBlockPattern(slug) {
  return DEFAULT_PATTERNS.find((p) => p.slug === slug) || null;
}

module.exports = { DEFAULT_PATTERNS, listBlockPatterns, getBlockPattern };
