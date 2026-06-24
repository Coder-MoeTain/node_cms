function getCsrfToken() {
  return document.querySelector('input[name="_csrf"]')?.value || '';
}

function initMediaLibrary() {
  const grid = document.querySelector('[data-media-library-grid]') || document.querySelector('.media-grid');
  if (!grid) return;

  const gridBtn = document.querySelector('[data-view-toggle="grid"]');
  const listBtn = document.querySelector('[data-view-toggle="list"]');
  const searchInput = document.querySelector('[data-media-search]');
  const dropzone = document.querySelector('.upload-dropzone');
  const fileInput = dropzone?.querySelector('[data-preview-file]');
  const detailModalEl = document.getElementById('mediaDetailModal');

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
    grid.querySelectorAll('[data-media-item]').forEach((item) => {
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

  function openMediaDetail(item) {
    if (!detailModalEl || !window.bootstrap) return;
    const preview = detailModalEl.querySelector('[data-media-detail-preview]');
    const nameEl = detailModalEl.querySelector('[data-media-detail-name]');
    const typeEl = detailModalEl.querySelector('[data-media-detail-type]');
    const dateEl = detailModalEl.querySelector('[data-media-detail-date]');
    const urlEl = detailModalEl.querySelector('[data-media-detail-url]');
    const editLink = detailModalEl.querySelector('[data-media-detail-edit]');
    const deleteForm = detailModalEl.querySelector('[data-media-detail-delete]');
    const copyBtn = detailModalEl.querySelector('[data-media-detail-copy]');
    const altEl = detailModalEl.querySelector('[data-media-detail-alt]');
    const captionEl = detailModalEl.querySelector('[data-media-detail-caption]');
    const descriptionEl = detailModalEl.querySelector('[data-media-detail-description]');

    const id = item.dataset.id;
    const filePath = item.dataset.filePath;
    const thumb = item.dataset.thumb;
    const fileType = item.dataset.fileType;
    const originalName = item.dataset.originalName;
    const uploaded = item.dataset.uploaded;
    const alt = item.dataset.alt || '';
    const caption = item.dataset.caption || '';
    const description = item.dataset.description || '';

    nameEl.textContent = originalName || 'Attachment';
    typeEl.textContent = item.dataset.mime || fileType || 'file';
    dateEl.textContent = uploaded ? new Date(uploaded).toLocaleString() : '—';
    urlEl.textContent = filePath || '';
    if (altEl) altEl.textContent = alt || '—';
    if (captionEl) captionEl.textContent = caption || '—';
    if (descriptionEl) descriptionEl.textContent = description || '—';
    editLink.href = `/admin/media/${id}/edit`;
    deleteForm.action = `/admin/media/${id}?_method=DELETE`;
    deleteForm.querySelector('input[name="_csrf"]').value = getCsrfToken();

    if (fileType === 'image') {
      preview.innerHTML = `<img src="${thumb || filePath}" alt="${alt || originalName || ''}">`;
    } else if (fileType === 'video') {
      preview.innerHTML = `<video controls class="w-100" src="${filePath}"></video>`;
    } else {
      preview.innerHTML = `<div class="media-detail-file"><i class="bi bi-file-earmark fs-1" aria-hidden="true"></i><span>${originalName || 'File'}</span></div>`;
    }

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(filePath || '');
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 1500);
    };

    bootstrap.Modal.getOrCreateInstance(detailModalEl).show();
  }

  grid.querySelectorAll('[data-media-item]').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (event.target.closest('[data-copy-url]')) return;
      openMediaDetail(item);
    });
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMediaDetail(item);
      }
    });
  });

  document.querySelectorAll('[data-copy-url]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      navigator.clipboard.writeText(button.dataset.copyUrl || '');
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy URL'; }, 1500);
    });
  });

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', () => {
      const selector = button.dataset.copyTarget;
      const input = selector ? document.querySelector(selector) : null;
      if (input) {
        navigator.clipboard.writeText(input.value || '');
        const label = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = label; }, 1500);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initMediaLibrary);
