(function () {
  const modal = document.getElementById('npThemePreviewModal');
  const modalImg = modal?.querySelector('[data-theme-preview-image]');
  const modalTitle = modal?.querySelector('[data-theme-preview-title]');

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-theme-preview-open]');
    if (!trigger || !modal || !modalImg) return;
    event.preventDefault();
    const thumb = trigger.dataset.thumb || trigger.getAttribute('href');
    const full = trigger.dataset.full || thumb;
    modalImg.src = full;
    if (modalTitle) modalTitle.textContent = trigger.dataset.name || 'Theme preview';
    const bsModal = window.bootstrap?.Modal?.getOrCreateInstance(modal);
    bsModal?.show();
  });

  const root = document.getElementById('np-themes-admin');
  if (!root) return;

  const searchInput = root.querySelector('[data-theme-filter]');
  const typeSelect = root.querySelector('[data-theme-type]');
  const cards = [...root.querySelectorAll('[data-theme-card]')];
  const countEl = root.querySelector('[data-theme-visible-count]');
  const uploadZone = root.querySelector('[data-theme-upload-zone]');
  const uploadInput = root.querySelector('#theme-archive');

  function applyFilter() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const type = typeSelect?.value || 'all';
    let visible = 0;
    cards.forEach((card) => {
      const matchesText = !q || (card.dataset.name || '').includes(q);
      const matchesType = type === 'all'
        || (type === 'child' && card.dataset.child === '1')
        || (type === 'parent' && card.dataset.child === '0')
        || (type === 'portal' && card.dataset.portal === '1');
      const show = matchesText && matchesType;
      card.classList.toggle('d-none', !show);
      if (show) visible += 1;
    });
    if (countEl) countEl.textContent = String(visible);
  }

  searchInput?.addEventListener('input', applyFilter);
  typeSelect?.addEventListener('change', applyFilter);

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
      const nameEl = uploadZone.querySelector('[data-theme-upload-name]');
      if (nameEl) nameEl.textContent = file.name;
    });
    uploadInput.addEventListener('change', () => {
      const nameEl = uploadZone.querySelector('[data-theme-upload-name]');
      if (nameEl) nameEl.textContent = uploadInput.files?.[0]?.name || 'No file chosen';
    });
  }

  applyFilter();
})();
