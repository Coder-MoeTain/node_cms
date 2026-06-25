/**
 * NodePress Admin Search — Phase 10
 * Quick navigation across admin screens (client-side index)
 */
(function () {
  const wrap = document.querySelector('[data-admin-search]');
  const input = document.querySelector('[data-admin-search-input]');
  const results = document.querySelector('[data-admin-search-results]');
  if (!wrap || !input || !results) return;

  const destinations = [
    { group: 'Content', label: 'All Posts', href: '/admin/posts', keywords: 'posts blog articles' },
    { group: 'Content', label: 'Add New Post', href: '/admin/posts/create', keywords: 'new post create' },
    { group: 'Content', label: 'All Pages', href: '/admin/pages', keywords: 'pages' },
    { group: 'Content', label: 'Add New Page', href: '/admin/pages/create', keywords: 'new page create' },
    { group: 'Content', label: 'Comments', href: '/admin/comments', keywords: 'comments moderation' },
    { group: 'Content', label: 'Categories', href: '/admin/categories', keywords: 'categories taxonomy' },
    { group: 'Content', label: 'Tags', href: '/admin/tags', keywords: 'tags' },
    { group: 'Media', label: 'Media Library', href: '/admin/media', keywords: 'media images files upload' },
    { group: 'Appearance', label: 'Themes', href: '/admin/themes', keywords: 'themes appearance design' },
    { group: 'Appearance', label: 'Customize', href: '/admin/themes/customize', keywords: 'customize colors logo' },
    { group: 'Appearance', label: 'Menus', href: '/admin/menus', keywords: 'menus navigation' },
    { group: 'Appearance', label: 'Widgets', href: '/admin/widgets', keywords: 'widgets sidebar homepage' },
    { group: 'Plugins', label: 'Plugins', href: '/admin/plugins', keywords: 'plugins extensions' },
    { group: 'Users', label: 'All Users', href: '/admin/users', keywords: 'users accounts' },
    { group: 'Users', label: 'Roles & Permissions', href: '/admin/roles', keywords: 'roles permissions rbac' },
    { group: 'Tools', label: 'Site Health', href: '/admin/tools/health', keywords: 'health diagnostics status' },
    { group: 'Tools', label: 'Import', href: '/admin/tools/import', keywords: 'import migrate' },
    { group: 'Tools', label: 'Export', href: '/admin/tools/export', keywords: 'export backup' },
    { group: 'Tools', label: 'Updates', href: '/admin/updates', keywords: 'updates version core' },
    { group: 'Security', label: 'Security Settings', href: '/admin/security', keywords: 'security backup logs' },
    { group: 'Security', label: 'WAF Dashboard', href: '/admin/waf', keywords: 'waf firewall' },
    { group: 'Security', label: 'WAF Rules', href: '/admin/waf/rules', keywords: 'waf rules block' },
    { group: 'Security', label: 'WAF Logs', href: '/admin/waf/logs', keywords: 'waf logs blocked' },
    { group: 'Settings', label: 'General Settings', href: '/admin/settings', keywords: 'settings general site title' },
    { group: 'Settings', label: 'Database', href: '/admin/settings/database', keywords: 'database mysql' },
    { group: 'Dashboard', label: 'Dashboard', href: '/admin', keywords: 'dashboard home admin' }
  ];

  function render(query) {
    const q = query.trim().toLowerCase();
    const matches = q
      ? destinations.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(q))
      : destinations.slice(0, 8);

    if (!matches.length) {
      results.innerHTML = '<div class="topbar-search-group"><span class="topbar-search-group-label">No results</span></div>';
      results.classList.add('is-open');
      return;
    }

    const grouped = matches.reduce((map, item) => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
      return map;
    }, {});

    results.innerHTML = Object.keys(grouped).map((group) => `
      <div class="topbar-search-group">
        <div class="topbar-search-group-label">${group}</div>
        ${grouped[group].map((item) => `<a href="${item.href}" role="option">${item.label}</a>`).join('')}
      </div>
    `).join('');
    results.classList.add('is-open');
  }

  function closeResults() {
    results.classList.remove('is-open');
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) closeResults();
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus();
      render(input.value);
    }
    if (event.key === 'Escape') closeResults();
  });
})();
