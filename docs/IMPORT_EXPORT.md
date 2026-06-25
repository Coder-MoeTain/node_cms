# Import / Export

## Export

Admin → **Tools → Export** → download JSON containing posts, pages, categories, tags, menus, widget areas, and optional media metadata.

CLI:

```bash
node bin/nodepress export backup.json
```

## Import

1. Admin → **Tools → Import**
2. Upload a NodePress JSON export
3. Preview counts
4. Run import (optional **Dry run**)

Programmatic:

```javascript
const { importSite, previewImport } = require('./utils/importer');
```

## Security

- Import runs server-side with validation
- Use dry-run before production imports
- Back up database before full imports

## Testing

See `tests/wordpressFeatures.test.js`.
