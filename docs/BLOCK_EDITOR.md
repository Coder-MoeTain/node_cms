# Block Editor

NodePress includes a Gutenberg-inspired block editor (lightweight, not a full WordPress clone).

## Admin usage

1. Edit a **Post**, **Page**, or **Custom post type** entry (when the type supports the editor).
2. Switch **Editor mode** to **Blocks**.
3. Add blocks from the toolbar, insert a **Pattern**, or insert a saved **Reusable** block.
4. Move, duplicate, or delete blocks.
5. Save — content is stored as JSON in `block_content_json` and rendered to `content` / `rendered_content_cache`.

## Block types (22)

paragraph, heading, image, quote, button, list, columns, gallery, cover, embed, separator, code, video, audio, file, table, html, spacer, **latest-posts**, **contact-form**, **shortcode**, **media-gallery**

## Patterns

Built-in patterns: `hero-intro`, `two-column`, `news-section`, `contact-cta`

- API: `GET /admin/api/block-patterns`
- Detail: `GET /admin/api/block-patterns/:slug`
- Editor: click **Patterns** in the block toolbar

## Reusable blocks

Stored in site settings (`reusable_blocks_json`).

- API: `GET /admin/api/reusable-blocks`
- Detail: `GET /admin/api/reusable-blocks/:slug`
- Save: `POST /admin/api/reusable-blocks` (editor ★ button or API)
- Editor: click **Reusable** in the block toolbar
- Utility: `utils/reusableBlocks.js`

## Data format

```json
[
  { "type": "paragraph", "content": "Hello world" },
  { "type": "heading", "content": "Title", "attrs": { "level": 2 } },
  { "type": "latest-posts", "attrs": { "limit": 5 } }
]
```

## Developer usage

- Renderer: `utils/blockRenderer.js`
- Public render: `utils/publicContentRenderer.js`
- Patterns: `utils/blockPatterns.js`
- Admin JS: `public/js/block-editor.js`

## Security

- HTML block uses `sanitize-html`.
- Block schema is validated on save.
- Dynamic blocks (latest-posts) render via shortcodes at request time with `recentPosts` context.

## Testing

```bash
npm test -- tests/loop11Commercial.test.js tests/utilsCoverage.test.js tests/wordpressFeatures.test.js
```
