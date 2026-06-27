(function () {
  const root = document.getElementById('np-content-types-admin');
  if (root) {
    const searchInput = root.querySelector('[data-cpt-filter]');
    const statusFilter = root.querySelector('[data-cpt-status]');
    const visibleCountEl = root.querySelector('[data-cpt-visible-count]');
    const noResults = root.querySelector('[data-cpt-no-results]');
    const cards = [...root.querySelectorAll('[data-cpt-card]')];

    function applyFilters() {
      const query = (searchInput?.value || '').trim().toLowerCase();
      const status = statusFilter?.value || 'all';
      let visible = 0;

      cards.forEach((card) => {
        const name = card.getAttribute('data-name') || '';
        const cardStatus = card.getAttribute('data-status') || '';
        const matchesQuery = !query || name.includes(query);
        const matchesStatus = status === 'all' || cardStatus === status;
        const show = matchesQuery && matchesStatus;
        card.classList.toggle('d-none', !show);
        if (show) visible += 1;
      });

      if (visibleCountEl) visibleCountEl.textContent = String(visible);
      if (noResults) noResults.classList.toggle('d-none', visible > 0 || !cards.length);
    }

    searchInput?.addEventListener('input', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
    applyFilters();
  }

  const formRoot = document.getElementById('np-cpt-form');
  if (!formRoot) return;

  const nameInput = formRoot.querySelector('[data-cpt-name-input]');
  const slugInput = formRoot.querySelector('[data-cpt-slug-input]');
  const slugPreview = formRoot.querySelector('[data-cpt-slug-preview]');
  const iconInput = formRoot.querySelector('[data-cpt-icon-input]');
  const iconText = formRoot.querySelector('[data-cpt-icon-text]');
  const iconPreview = formRoot.querySelector('[data-cpt-icon-preview]');
  const iconOptions = [...formRoot.querySelectorAll('[data-cpt-icon-pick]')];
  let slugTouched = Boolean(slugInput?.value);

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function updateSlugPreview(value) {
    if (slugPreview) slugPreview.textContent = `/types/${value || 'your-slug'}`;
  }

  slugInput?.addEventListener('input', () => {
    slugTouched = true;
    updateSlugPreview(slugInput.value || slugify(slugInput.value));
  });

  nameInput?.addEventListener('input', () => {
    if (!slugTouched && slugInput) {
      slugInput.value = slugify(nameInput.value);
      updateSlugPreview(slugInput.value);
    }
  });

  function setIcon(value) {
    const icon = value || 'bi-file-earmark';
    if (iconInput) iconInput.value = icon;
    if (iconText) iconText.value = icon;
    if (iconPreview) iconPreview.className = `bi ${icon}`;
    iconOptions.forEach((btn) => btn.classList.toggle('is-selected', btn.dataset.cptIconPick === icon));
  }

  iconOptions.forEach((btn) => {
    btn.addEventListener('click', () => setIcon(btn.dataset.cptIconPick));
  });

  iconText?.addEventListener('input', () => setIcon(iconText.value.trim()));

  updateSlugPreview(slugInput?.value || slugify(nameInput?.value));
})();
