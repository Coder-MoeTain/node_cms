# Custom Post Types

NodePress supports WordPress-like **Custom Post Types (CPT)** stored in `custom_post_types`, with content items stored in the existing `posts` table using a `post_type` column.

## Admin usage

1. Go to **Content Types → Post Types** (`/admin/custom-post-types`).
2. Create a type (e.g. News, Events, Jobs) and configure supports (title, editor, excerpt, featured image, revisions, custom fields).
3. Enable **Show in admin menu** to add a sidebar entry.
4. Manage items under **Content Types → {Your Type}** or `/admin/content/{slug}`.
5. Published items with **Has archive** appear at `/types/{slug}` (archive) and `/types/{slug}/{item-slug}` (single).

## Developer usage

- Model: `models/CustomPostType.js`
- Admin: `controllers/admin/customPostTypeController.js`, `controllers/admin/customContentController.js`
- Public: `controllers/public/customContentController.js`
- Migration: `database/migrations/012_custom_post_types_fields_revisions.sql`

Register-like behavior is database-driven; plugins can hook `afterPostSave` for standard posts but CPT items use the custom content controller.

## REST API

When `show_in_api` is enabled:

- `GET /api/v1/types`
- `GET /api/v1/types/:slug/content`
- `GET /api/v1/types/:slug/content/:idOrSlug`

## Security

- CPT admin routes require `manage_custom_post_types` or `manage_custom_content` permissions.
- Content is sanitized with the same HTML rules as posts.
- Slugs are unique per `post_type` scope when creating items.

## Testing

```bash
npm test -- tests/customPostTypes.test.js
```

See also [WORDPRESS_GAP_ANALYSIS.md](./WORDPRESS_GAP_ANALYSIS.md).
