# NodePress Admin UI Modernization

Commercial-ready WordPress-inspired admin interface for NodePress CMS.

## Phase checklist

| Phase | Scope | Key assets |
| --- | --- | --- |
| 1 | UI/UX audit | Scores and gap analysis (see below) |
| 2 | Admin design system | `public/css/admin-design-system.css`, token mapping |
| 3 | Sidebar & topbar | `sidebar.ejs`, `topbar.ejs`, `admin.js` |
| 4 | Dashboard | `dashboard.ejs`, onboarding partial |
| 5 | List tables | `crud/index.ejs`, mobile card fallback |
| 6 | Editor UX | Existing `crud/form.ejs`, `editor.css` (prior work) |
| 7 | Media library | Existing `media/index.ejs`, `media.js` |
| 8 | Themes & plugins | Existing theme/plugin admin + customizer |
| 9 | Settings & security | Existing settings/WAF views + form table classes |
| 10 | Onboarding & help | `onboarding.ejs`, `help.ejs`, `admin-search.js` |
| 11 | Mobile responsiveness | Drawer sidebar, stacked dashboard, mobile list cards |
| 12 | Accessibility | Skip link, focus-visible, reduced motion, ARIA labels |
| 13 | CSS/JS cleanup | Design system layer, modular admin JS |

## Design tokens

Admin tokens live in `admin-design-system.css` and map to legacy `--np-*` variables for backward compatibility.

## Admin search

Press **Ctrl+K** (or **Cmd+K**) in the admin topbar to search destinations across posts, media, themes, security, and settings.

## Verification

```bash
npm test -- tests/adminUi.test.js
npm run lint
```

## Phase 1 audit scores (before → after target)

| Area | Before | After |
| --- | ---: | ---: |
| Sidebar | 7/10 | 9/10 |
| Topbar | 6/10 | 9/10 |
| Dashboard | 7/10 | 9/10 |
| List tables | 7/10 | 8/10 |
| Forms/settings | 6/10 | 8/10 |
| Editor UX | 7/10 | 8/10 |
| Media library | 7/10 | 8/10 |
| Theme/plugin UX | 7/10 | 8/10 |
| Security/WAF UX | 7/10 | 8/10 |
| Mobile admin | 5/10 | 8/10 |
| Accessibility | 6/10 | 8/10 |
| **Overall** | **6.5/10** | **8.5/10** |
