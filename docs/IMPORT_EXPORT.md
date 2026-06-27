# Import / Export

## Export formats

Admin → **Tools → Export**

| Format | Route | Contents |
|--------|-------|----------|
| JSON | `/admin/tools/export/download` | Full site: posts, pages, CPT, fields, menus, widgets, taxonomies, media metadata |
| CSV | `/admin/tools/export/csv?type=posts\|pages` | Posts or pages spreadsheet |
| WXR | `/admin/tools/export/wxr` | WordPress-compatible XML + NodePress extensions (menus, CPT, field groups) |

CLI:

```bash
node bin/nodepress export backup.json
```

## Import

1. Admin → **Tools → Import**
2. Upload JSON, CSV, or WordPress WXR (`.xml`)
3. Preview counts
4. Run import (optional **Dry run**)
5. For WXR: optional **Download remote media**

Supported CSV columns (posts): `title`, `slug`, `status`, `post_type`, `content`, `excerpt`, `category_id`

## Programmatic

```javascript
const { importSite, previewImport } = require('./utils/importer');
const { csvToImportPayload } = require('./utils/csvImporter');
```

## Security

- Import runs server-side with validation
- WXR remote media download is SSRF-protected
- Use dry-run before production imports
- Back up database before full imports

## Testing

```bash
npm test -- tests/wxrImport.test.js tests/wxrExportExtended.test.js tests/loop11Commercial.test.js tests/adminCrudImportExport.test.js
```
