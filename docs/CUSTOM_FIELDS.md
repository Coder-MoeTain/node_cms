# Custom Fields (Meta Boxes)

Field groups attach custom meta boxes to post types, pages, or custom post types.

## Admin usage

1. Go to **Content Types → Field Groups** (`/admin/field-groups`).
2. Create a group and set **Location type** + **Location value** (e.g. `custom_post_type` + `news`).
3. Add fields (text, textarea, date, select, etc.).
4. When editing matching content, fields appear as metaboxes in the editor.

## Supported field types

`text`, `textarea`, `rich_text`, `number`, `date`, `datetime`, `select`, `checkbox`, `radio`, `image`, `file`, `url`, `email`, `color`, `repeater`, `group`

## Developer usage

- Tables: `field_groups`, `custom_fields`, `custom_field_values`
- Utils: `utils/customFields.js` — load, save, validate, sanitize
- Partial: `views/admin/partials/custom-field-meta-boxes.ejs`

Load values on the public site:

```javascript
const { loadCustomFieldsMap } = require('../utils/customFields');
const fields = await loadCustomFieldsMap('custom_post', postId, 'custom_post_type', 'news');
```

API responses include `custom_fields` when fetching CPT items via `/api/v1/types/:slug/content/:id`.

## Security

- All values sanitized on save; rich text uses `sanitize-html`.
- Required fields validated server-side.
- Public templates should escape plain text fields; rich text is pre-sanitized.

## Testing

```bash
npm test -- tests/customPostTypes.test.js
```

See [CUSTOM_POST_TYPES.md](./CUSTOM_POST_TYPES.md).
