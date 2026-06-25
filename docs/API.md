# NodePress CMS API

Public read API for headless integrations. All routes are under `/api` and require a valid API key when `API_KEY` is set in the environment.

## Authentication

Send the key in a header:

```http
X-API-Key: your-api-key
```

Or as a query parameter (less secure):

```http
GET /api/posts?api_key=your-api-key
```

When `API_KEY` is unset, the middleware allows requests (development only).

## API v1 (WordPress-like)

Versioned routes under `/api/v1` with pagination metadata:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/posts` | Published blog posts (`post_type=post`) |
| GET | `/api/v1/posts/:idOrSlug` | Single post |
| GET | `/api/v1/pages/:idOrSlug` | Single page |
| GET | `/api/v1/types` | Active custom post types |
| GET | `/api/v1/types/:slug/content` | Published items for a CPT |
| GET | `/api/v1/types/:slug/content/:idOrSlug` | Single CPT item + custom fields |
| GET | `/api/v1/categories` | Categories |
| GET | `/api/v1/tags` | Tags |
| GET | `/api/v1/media` | Media library (paginated) |
| GET | `/api/v1/settings` | Public settings (`public_*` keys) |

Legacy routes (`/api/posts`, etc.) remain for backward compatibility.

## Endpoints (legacy)

### List published posts

```http
GET /api/posts
```

Response: JSON array of published posts with category and tags.

### Single post by slug

```http
GET /api/posts/:slug
```

Response: post object or `404` with `{ "message": "Post not found" }`.

### Single page by slug

```http
GET /api/pages/:slug
```

Response: page object or `404`.

## Rate limiting

API routes use `apiLimiter` (300 requests / 15 minutes per IP by default).

## Errors

| Status | Meaning |
|--------|---------|
| 401 | Missing or invalid API key |
| 404 | Resource not found |
| 500 | Server error |

## Health (no API key)

```http
GET /health   → { status, uptime, timestamp }
GET /ready    → { status, database } or 503 if DB down
```

## Examples

```bash
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/posts
curl http://localhost:3000/api/posts/welcome-to-nodepress-cms
```

For admin mutations, use the web UI or extend `routes/api.js` with authenticated endpoints.
