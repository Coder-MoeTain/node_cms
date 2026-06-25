# Block Editor

NodePress includes a lightweight block editor inspired by WordPress Gutenberg (not a full clone).

## Admin usage

1. Edit a **Post** or **Page**.
2. Switch **Editor mode** to **Blocks**.
3. Add blocks from the toolbar (paragraph, heading, image, quote, button, list, HTML, spacer).
4. Move, duplicate, or delete blocks.
5. Save — content is stored as JSON in `block_content_json` and rendered to `content` / `rendered_content_cache`.

## Data format

```json
[
  { "type": "paragraph", "content": "Hello world" },
  { "type": "heading", "content": "Title", "attrs": { "level": 2 } }
]
```

## Developer usage

- Renderer: `utils/blockRenderer.js`
- Admin JS: `public/js/block-editor.js`
- Partial: `views/admin/partials/content-editor.ejs`

## Security

- HTML block uses `sanitize-html`.
- Block schema is validated on save.
- Script tags are stripped on render.

## Testing

```bash
npm test -- tests/wordpressFeatures.test.js tests/customPostTypes.test.js
```
