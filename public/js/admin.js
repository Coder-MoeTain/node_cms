function npConfirm(message, title = 'Please confirm') {
  return new Promise((resolve) => {
    const modalEl = document.getElementById('npConfirmModal');
    if (!modalEl || !window.bootstrap) {
      resolve(window.confirm(message));
      return;
    }
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalEl.querySelector('[data-confirm-message]').textContent = message;
    modalEl.querySelector('#npConfirmModalLabel').textContent = title;
    const accept = modalEl.querySelector('[data-confirm-accept]');
    let accepted = false;
    const onAccept = () => {
      accepted = true;
      modal.hide();
    };
    const onHidden = () => {
      accept.removeEventListener('click', onAccept);
      resolve(accepted);
    };
    accept.addEventListener('click', onAccept);
    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });
    modal.show();
  });
}

document.querySelectorAll('[data-confirm]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const ok = await npConfirm(form.dataset.confirm || 'Are you sure?');
    if (ok) form.submit();
  });
});

const sidebar = document.querySelector('.admin-sidebar');
const overlay = document.querySelector('[data-sidebar-overlay]');

function openSidebar() {
  document.body.classList.add('admin-sidebar-open');
  sidebar?.classList.add('open');
  overlay?.classList.add('show');
}

function closeSidebar() {
  document.body.classList.remove('admin-sidebar-open');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
}

document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => {
  if (sidebar?.classList.contains('open')) closeSidebar();
  else openSidebar();
});

document.querySelector('[data-sidebar-close]')?.addEventListener('click', closeSidebar);
overlay?.addEventListener('click', closeSidebar);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sidebar?.classList.contains('open')) closeSidebar();
});

document.querySelectorAll('.admin-sidebar .collapse').forEach((collapseEl) => {
  collapseEl.addEventListener('show.bs.collapse', () => {
    if (window.innerWidth < 992) {
      document.querySelectorAll('.admin-sidebar .collapse.show').forEach((openEl) => {
        if (openEl !== collapseEl) bootstrap.Collapse.getOrCreateInstance(openEl, { toggle: false }).hide();
      });
    }
  });
});

window.addEventListener('resize', () => {
  if (window.innerWidth >= 992) closeSidebar();
});

document.querySelector('[data-user-menu]')?.addEventListener('click', (event) => {
  const menu = event.currentTarget;
  if (event.target.closest('.user-dropdown')) return;
  menu.classList.toggle('open');
  const button = menu.querySelector('.user-chip');
  button?.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-user-menu]')) {
    document.querySelectorAll('[data-user-menu].open').forEach((menu) => {
      menu.classList.remove('open');
      menu.querySelector('.user-chip')?.setAttribute('aria-expanded', 'false');
    });
  }
});

if (window.tinymce) {
  tinymce.init({
    selector: '.rich-editor',
    license_key: 'gpl',
    height: 420,
    menubar: false,
    plugins: 'link image media table lists code autoresize',
    toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image media | code',
    content_css: false,
    skin: false
  });
}

document.querySelector('[data-preview-file]')?.addEventListener('change', (event) => {
  const preview = document.querySelector('.upload-preview');
  if (!preview) return;
  preview.innerHTML = '';
  [...event.target.files].forEach((file) => {
    const item = document.createElement('span');
    item.className = 'np-badge np-badge-muted me-1';
    item.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    preview.appendChild(item);
  });
});

let activeMediaTargetField = null;
window.activeMediaTargetField = activeMediaTargetField;

function updateMediaPreview(fieldName, filePath) {
  const container = document.querySelector(`[data-image-upload] [name="${fieldName}"]`)?.closest('[data-image-upload]')
    || document.querySelector(`[data-media-preview="${fieldName}"]`)?.closest('[data-image-upload]');
  const previewContainer = document.querySelector(`[data-media-preview="${fieldName}"]`);

  if (container?.classList.contains('featured-image-box')) {
    container.innerHTML = `
      <input type="hidden" name="${fieldName}" value="${filePath}" data-image-path>
      <input type="hidden" name="remove_${fieldName}" value="0" data-image-remove-flag>
      <input class="d-none" type="file" name="${fieldName}_file" accept="image/*" data-image-file>
      <img class="featured-image-preview" data-image-preview data-media-preview="${fieldName}" src="${filePath}" alt="Featured image preview">
      <div class="featured-image-actions mt-2">
        <button class="np-btn np-btn-secondary np-btn-small" type="button" data-open-media-picker="${fieldName}">Replace image</button>
        <button class="np-btn np-btn-link np-btn-small text-danger" type="button" data-remove-image>Remove featured image</button>
      </div>`;
    const newContainer = container;
    newContainer.querySelector('[data-remove-image]')?.addEventListener('click', () => clearImageUploadField(newContainer));
    return;
  }

  if (!previewContainer) return;

  if (previewContainer.tagName.toLowerCase() === 'img') {
    previewContainer.src = filePath;
    return;
  }

  const image = document.createElement('img');
  image.className = 'settings-image-preview';
  image.dataset.mediaPreview = fieldName;
  image.dataset.imagePreview = 'true';
  image.src = filePath;
  image.alt = `${fieldName} preview`;
  previewContainer.replaceWith(image);
}

function clearImageUploadField(container) {
  const pathInput = container.querySelector('[data-image-path]');
  const removeFlag = container.querySelector('[data-image-remove-flag]');
  const fileInput = container.querySelector('[data-image-file]');
  const preview = container.querySelector('[data-image-preview]');
  const removeButton = container.querySelector('[data-remove-image]');

  if (pathInput) pathInput.value = '';
  if (removeFlag) removeFlag.value = '1';
  if (fileInput) fileInput.value = '';

  if (preview) {
    const isFeatured = container.classList.contains('featured-image-box');
    const empty = document.createElement(isFeatured ? 'div' : 'div');
    if (isFeatured) {
      empty.className = 'featured-image-placeholder';
      empty.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i><p class="mb-2">Set a featured image</p><button class="np-btn np-btn-secondary np-btn-small" type="button" data-open-media-picker="' + (pathInput?.name || '') + '">Set featured image</button>';
      empty.dataset.imagePreview = 'true';
      if (pathInput?.name) empty.dataset.mediaPreview = pathInput.name;
    } else {
      empty.className = 'settings-empty-preview';
      empty.dataset.imagePreview = 'true';
      if (pathInput?.name) empty.dataset.mediaPreview = pathInput.name;
      empty.textContent = 'No image selected';
    }
    preview.replaceWith(empty);
  }

  removeButton?.remove();
}

document.addEventListener('click', (event) => {
  const removeBtn = event.target.closest('[data-remove-image]');
  if (!removeBtn) return;
  const container = removeBtn.closest('[data-image-upload]');
  if (container) clearImageUploadField(container);
});

document.querySelectorAll('[data-image-upload]').forEach((container) => {
  container.querySelector('[data-remove-image]')?.addEventListener('click', () => {
    clearImageUploadField(container);
  });

  container.querySelector('[data-image-file]')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const pathInput = container.querySelector('[data-image-path]');
    const removeFlag = container.querySelector('[data-image-remove-flag]');
    const preview = container.querySelector('[data-image-preview]');
    if (!file || !preview) return;

    if (removeFlag) removeFlag.value = '0';
    if (pathInput) pathInput.value = '';

    const objectUrl = URL.createObjectURL(file);
    if (preview.tagName.toLowerCase() === 'img') {
      preview.src = objectUrl;
      return;
    }

    const image = document.createElement('img');
    image.className = 'settings-image-preview';
    image.dataset.imagePreview = 'true';
    if (pathInput?.name) image.dataset.mediaPreview = pathInput.name;
    image.src = objectUrl;
    image.alt = 'Selected image preview';
    preview.replaceWith(image);
  });
});

function selectMediaItem(item) {
  const field = activeMediaTargetField || window.activeMediaTargetField;
  if (!field) return;
  const input = document.querySelector(`[name="${field}"]`);
  if (!input) return;

  const container = input.closest('[data-image-upload]');
  const removeFlag = container?.querySelector('[data-image-remove-flag]');
  const fileInput = container?.querySelector('[data-image-file]');

  input.value = item.filePath;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  if (removeFlag) removeFlag.value = '0';
  if (fileInput) fileInput.value = '';
  updateMediaPreview(field, item.filePath);
  bootstrap.Modal.getInstance(document.getElementById('mediaGalleryModal'))?.hide();
}

async function loadMediaGallery() {
  const grid = document.querySelector('[data-media-gallery-grid]');
  if (!grid) return;

  grid.innerHTML = '<div class="media-gallery-empty">Loading media...</div>';
  try {
    const response = await fetch('/admin/settings/media-gallery?type=image', {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();

    if (!data.items?.length) {
      grid.innerHTML = '<div class="media-gallery-empty">No images found. Upload images in Media Library first.</div>';
      return;
    }

    grid.innerHTML = data.items.map((item) => `
      <button type="button" class="media-gallery-item" data-file-path="${item.filePath}" data-file-name="${item.originalName}">
        <img src="${item.thumbnailPath || item.filePath}" alt="${item.originalName}">
        <span>${item.originalName}</span>
      </button>
    `).join('');

    grid.querySelectorAll('.media-gallery-item').forEach((button) => {
      button.addEventListener('click', () => {
        selectMediaItem({ filePath: button.dataset.filePath, name: button.dataset.fileName });
      });
    });
  } catch (error) {
    grid.innerHTML = '<div class="media-gallery-empty">Unable to load media gallery.</div>';
  }
}

document.querySelectorAll('[data-open-media-gallery]').forEach((button) => {
  button.addEventListener('click', () => {
    activeMediaTargetField = button.dataset.openMediaGallery;
    window.activeMediaTargetField = activeMediaTargetField;
    loadMediaGallery();
  });
});

document.querySelectorAll('[data-copy-url]').forEach((button) => {
  button.addEventListener('click', () => {
    navigator.clipboard.writeText(button.dataset.copyUrl || '');
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = 'Copy URL'; }, 1500);
  });
});

document.querySelectorAll('.toast.show').forEach((toast) => {
  setTimeout(() => toast.classList.remove('show'), 4000);
});

const selectAll = document.querySelector('[data-select-all]');
const rowChecks = () => [...document.querySelectorAll('.row-select')];
selectAll?.addEventListener('change', () => {
  rowChecks().forEach((box) => { box.checked = selectAll.checked; });
  updateBulkState();
});
rowChecks().forEach((box) => box.addEventListener('change', updateBulkState));

function updateBulkState() {
  const selected = rowChecks().filter((box) => box.checked);
  const bulkAction = document.querySelector('[data-bulk-action]');
  const bulkApply = document.querySelector('[data-bulk-apply]');
  const enabled = selected.length > 0;
  if (bulkAction) bulkAction.disabled = !enabled;
  if (bulkApply) bulkApply.disabled = !enabled;
}

document.querySelector('[data-bulk-apply]')?.addEventListener('click', async () => {
  const action = document.querySelector('[data-bulk-action]')?.value;
  const selected = rowChecks().filter((box) => box.checked);
  if (!action || !selected.length) return;
  if (action === 'delete') {
    const ok = await npConfirm(`Move ${selected.length} item(s) to trash?`, 'Move to trash');
    if (!ok) return;
    const form = document.getElementById('bulk-form');
    if (form) {
      form.querySelectorAll('input[name="ids"]').forEach((input) => input.remove());
      selected.forEach((box) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'ids';
        input.value = box.value;
        form.appendChild(input);
      });
      form.submit();
      return;
    }
    selected.forEach((box) => {
      const rowForm = box.closest('tr')?.querySelector('form[data-confirm]');
      if (rowForm) rowForm.requestSubmit();
    });
  }
});
