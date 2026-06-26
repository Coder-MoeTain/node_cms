(function () {
  const root = document.getElementById('np-plugins-admin');
  if (!root) return;

  const searchInput = root.querySelector('[data-plugin-filter]');
  const statusSelect = root.querySelector('[data-plugin-status]');
  const viewButtons = [...root.querySelectorAll('[data-plugin-view]')];
  const listView = root.querySelector('[data-plugin-list-view]');
  const gridView = root.querySelector('[data-plugin-grid-view]');
  const rows = [...root.querySelectorAll('[data-plugin-row]')];
  const cards = [...root.querySelectorAll('[data-plugin-card]')];
  const countEl = root.querySelector('[data-plugin-visible-count]');
  const selectAll = root.querySelector('[data-plugin-select-all]');
  const bulkBar = root.querySelector('[data-plugin-bulk-bar]');
  const bulkForm = root.querySelector('[data-plugin-bulk-form]');
  const bulkAction = root.querySelector('[data-plugin-bulk-action]');
  const uploadZone = root.querySelector('[data-plugin-upload-zone]');
  const uploadInput = root.querySelector('#plugin-archive');

  function visibleItems() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const status = statusSelect?.value || 'all';
    const items = rows.length ? rows : cards;
    return items.filter((item) => {
      const matchesText = !q || (item.dataset.name || '').includes(q);
      let matchesStatus = status === 'all' || item.dataset.status === status;
      if (status === 'update') matchesStatus = item.dataset.update === 'yes';
      const visible = matchesText && matchesStatus;
      item.classList.toggle('d-none', !visible);
      return visible;
    });
  }

  function applyFilter() {
    const visible = visibleItems();
    if (countEl) {
      countEl.textContent = String(visible.length);
    }
    updateBulkBar();
  }

  function selectedSlugs() {
    return [...root.querySelectorAll('[data-plugin-checkbox]:checked')].map((el) => el.value);
  }

  function updateBulkBar() {
    const selected = selectedSlugs();
    if (bulkBar) {
      bulkBar.classList.toggle('is-visible', selected.length > 0);
      const label = bulkBar.querySelector('[data-plugin-selected-count]');
      if (label) label.textContent = String(selected.length);
    }
    if (selectAll) {
      const visibleCheckboxes = [...root.querySelectorAll('[data-plugin-row]:not(.d-none) [data-plugin-checkbox], [data-plugin-card]:not(.d-none) [data-plugin-checkbox]')];
      selectAll.checked = visibleCheckboxes.length > 0 && visibleCheckboxes.every((box) => box.checked);
      selectAll.indeterminate = visibleCheckboxes.some((box) => box.checked) && !selectAll.checked;
    }
  }

  function setView(view) {
    const isList = view === 'list';
    listView?.classList.toggle('d-none', !isList);
    gridView?.classList.toggle('d-none', isList);
    viewButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.pluginView === view);
    });
    try {
      localStorage.setItem('np-plugins-view', view);
    } catch {
      // ignore
    }
  }

  searchInput?.addEventListener('input', applyFilter);
  statusSelect?.addEventListener('change', applyFilter);

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.pluginView || 'list'));
  });

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-plugin-checkbox], [data-plugin-select-all]')) {
      if (event.target.matches('[data-plugin-select-all]')) {
        const checked = event.target.checked;
        root.querySelectorAll('[data-plugin-row]:not(.d-none) [data-plugin-checkbox], [data-plugin-card]:not(.d-none) [data-plugin-checkbox]')
          .forEach((box) => { box.checked = checked; });
      }
      updateBulkBar();
    }
  });

  bulkForm?.addEventListener('submit', (event) => {
    const action = bulkAction?.value;
    const slugs = selectedSlugs();
    if (!action || !slugs.length) {
      event.preventDefault();
      return;
    }
    if (action === 'delete') {
      const ok = window.confirm(`Delete ${slugs.length} plugin(s) from disk? This cannot be undone.`);
      if (!ok) event.preventDefault();
    }
    bulkForm.querySelectorAll('input[name="slugs[]"]').forEach((node) => node.remove());
    slugs.forEach((slug) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'slugs[]';
      input.value = slug;
      bulkForm.appendChild(input);
    });
  });

  if (uploadZone && uploadInput) {
    uploadZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      uploadZone.classList.add('is-dragover');
    });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('is-dragover'));
    uploadZone.addEventListener('drop', (event) => {
      event.preventDefault();
      uploadZone.classList.remove('is-dragover');
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      uploadInput.files = dt.files;
      const nameEl = uploadZone.querySelector('[data-plugin-upload-name]');
      if (nameEl) nameEl.textContent = file.name;
    });
    uploadInput.addEventListener('change', () => {
      const nameEl = uploadZone.querySelector('[data-plugin-upload-name]');
      if (nameEl) nameEl.textContent = uploadInput.files?.[0]?.name || 'No file chosen';
    });
  }

  const savedView = (() => {
    try {
      return localStorage.getItem('np-plugins-view');
    } catch {
      return null;
    }
  })();
  setView(savedView === 'grid' ? 'grid' : 'list');
  applyFilter();
})();
