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

## Endpoints

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
