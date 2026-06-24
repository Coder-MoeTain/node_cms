function initMediaLibrary() {
  const grid = document.querySelector('.media-grid');
  if (!grid) return;

  const gridBtn = document.querySelector('[data-view-toggle="grid"]');
  const listBtn = document.querySelector('[data-view-toggle="list"]');
  const searchInput = document.querySelector('[data-media-search]');
  const dropzone = document.querySelector('.upload-dropzone');
  const fileInput = dropzone?.querySelector('[data-preview-file]');

  function setView(mode) {
    grid.classList.toggle('media-grid-list', mode === 'list');
    gridBtn?.setAttribute('aria-pressed', mode === 'grid' ? 'true' : 'false');
    listBtn?.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
    gridBtn?.classList.toggle('np-btn-primary', mode === 'grid');
    gridBtn?.classList.toggle('np-btn-secondary', mode !== 'grid');
    listBtn?.classList.toggle('np-btn-primary', mode === 'list');
    listBtn?.classList.toggle('np-btn-secondary', mode !== 'list');
  }

  gridBtn?.addEventListener('click', () => setView('grid'));
  listBtn?.addEventListener('click', () => setView('list'));

  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    grid.querySelectorAll('.media-attachment').forEach((item) => {
      const name = item.dataset.name || '';
      item.hidden = query && !name.includes(query);
    });
  });

  if (dropzone && fileInput) {
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', (event) => {
      if (event.dataTransfer?.files?.length) {
        fileInput.files = event.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initMediaLibrary);
