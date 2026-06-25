# NodePress CLI

The `nodepress` command provides WP-CLI-style operations.

## Install

From the project root:

```bash
npm link
# or
node bin/nodepress help
```

## Commands

| Command | Description |
|---------|-------------|
| `nodepress health` | Run site health checks (JSON output) |
| `nodepress migrate` | Run SQL migrations |
| `nodepress cache:clear` | Clear translation cache |
| `nodepress seed` | Run database seed |
| `nodepress user:reset-password <email> <password>` | Reset a user password |

## Examples

```bash
nodepress health
nodepress migrate
nodepress user:reset-password admin@example.com 'NewSecure@123'
```

## Security

- CLI runs with full database access; use only on trusted servers.
- Password reset does not log the new password.

## Testing

Health checks are covered indirectly via `utils/siteHealth.js` and admin **Site Health** at `/admin/tools/health`.
