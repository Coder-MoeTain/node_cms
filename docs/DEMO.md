# NodePress CMS Demo

End-to-end workflow proof for custom content, fields, revisions, templates, import/export, and deployment.

## Quick tour

1. Start the stack: `npm run dev` or `docker compose up --build`.
2. Public site: [http://localhost:3000](http://localhost:3000)
3. Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login) — `admin@example.com` / `Admin@12345`
4. Health: `/health` and `/ready`

## Full workflow (matches integration tests)

| Step | Action | Verified by |
| --- | --- | --- |
| 1 | **Custom Post Type** — Admin → Custom Post Types → create type with archive | `customPostTypes.test.js` |
| 2 | **Publish CPT item** — Admin → Content → add item → view `/types/{slug}/{item}` | `customPostTypes.test.js` |
| 3 | **Field groups** — Admin → Field Groups → attach to CPT → required validation | `customFields.test.js` |
| 4 | **Custom fields on public** — Venue/details appear on single CPT page | `customFields.test.js` |
| 5 | **Revisions** — Edit post → Revisions → restore earlier snapshot | `revisionsAutosave.test.js` |
| 6 | **Autosave** — Draft autosave via `/admin/autosave` recovers title/body | `revisionsAutosave.test.js` |
| 7 | **Templates (FSE)** — Admin → Templates → seed defaults → edit block JSON | `templatesFse.test.js` |
| 8 | **Export** — Admin → Tools → Export, or `nodepress export out.json` | `importExport.integration.test.js` |
| 9 | **Import** — Upload JSON → preview → import (dry-run supported) | `importExport.integration.test.js` |
| 10 | **Multisite** — `MULTISITE_ENABLED=true` → Network → add site (optional) | `networkMultisite.test.js` |
| 11 | **Plugins / themes** — Upload, activate, deactivate, uninstall | `pluginsLifecycleIntegration.test.js` |
| 12 | **CLI** — `nodepress health`, `theme:list`, `plugin:list` | `cli.test.js` |

## Screenshots

| Public homepage | Admin dashboard |
| --- | --- |
| ![Public homepage](assets/screenshots/public-home.png) | ![Admin dashboard](assets/screenshots/admin-dashboard.png) |

### Suggested captures for a complete demo

Record these after running the workflow above and save under `docs/assets/screenshots/`:

| File | What to show |
| --- | --- |
| `cpt-archive.png` | Public archive at `/types/{your-type}` |
| `cpt-single-fields.png` | Single CPT with custom field values |
| `revisions-list.png` | Admin revisions screen before restore |
| `templates-editor.png` | Site Templates block editor |
| `import-preview.png` | Import preview counts |
| `translations-panel.png` | Post editor Translations tab |

## Demo video

Record a screen capture while running steps 1–11, then save as:

`docs/assets/nodepress-demo.mp4`

Embed in the README:

```html
<video src="docs/assets/nodepress-demo.mp4" controls width="100%"></video>
```

Until the video is recorded, the screenshot gallery and CI test suite serve as automated proof.

## CI verification

GitHub Actions (`.github/workflows/ci.yml`) on every push:

- ESLint
- Jest with coverage thresholds (`npm run test:ci`)
- `npm audit --audit-level=high`
- Docker Compose smoke test (`/health`, `/ready`, admin login)

Badges in the main README link to the workflow and Codecov.
