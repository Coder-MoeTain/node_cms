# NodePress CMS Demo

This walkthrough covers the public site, admin console, plugin lifecycle, and theme management features exercised by the integration test suite.

## Quick tour

1. Start the stack with `npm run dev` or `docker compose up --build`.
2. Open the public site at `http://localhost:3000`.
3. Sign in to the admin panel at `http://localhost:3000/admin/login` using `admin@example.com` / `Admin@12345`.
4. Browse **Themes** to activate bundled themes or upload a `.zip` child theme.
5. Browse **Plugins** to activate bundled plugins or upload a lifecycle plugin archive.
6. Verify health endpoints at `/health` and `/ready`.

## Screenshots

| Public homepage | Admin dashboard |
| --- | --- |
| ![Public homepage](assets/screenshots/public-home.png) | ![Admin dashboard](assets/screenshots/admin-dashboard.png) |

## Demo video

Record a short screen capture while running the steps above, then place the file at:

`docs/assets/nodepress-demo.mp4`

Embed it in the README with:

```html
<video src="docs/assets/nodepress-demo.mp4" controls width="100%"></video>
```

Until a recorded video is added, use the screenshot gallery in the main README preview section.

## CI verification

GitHub Actions runs lint, database sync, migrations, seed data, Jest coverage thresholds, npm audit, and a Docker Compose smoke test on every push.
