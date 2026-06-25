# Multisite (optional)

Multisite is **disabled by default**. Enable with:

```env
MULTISITE_ENABLED=true
```

## Features

- Network sites table (`sites`, `site_domains`, `site_users`, `network_site_settings`)
- Super Admin network dashboard at `/admin/network`
- Site resolution middleware (`middleware/siteResolver.js`) attaches `res.locals.currentSite`

## Limitations

- Full per-site content isolation requires `site_id` on content tables (future enhancement)
- Use for network management foundation; single-site mode is unchanged when disabled

## Testing

Multisite routes return redirect when disabled. Enable in test env to exercise network CRUD.
