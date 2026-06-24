document.querySelectorAll('[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!confirm(form.dataset.confirm || 'Are you sure?')) event.preventDefault();
  });
});

const sidebar = document.querySelector('.admin-sidebar');
const overlay = document.querySelector('[data-sidebar-overlay]');

function closeSidebar() {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
}

document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => {
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('show');
});

overlay?.addEventListener('click', closeSidebar);

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
  const previewContainer = document.querySelector(`[data-media-preview="${fieldName}"]`);
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
    const empty = document.createElement('div');
    empty.className = 'settings-empty-preview';
    empty.dataset.imagePreview = 'true';
    if (pathInput?.name) empty.dataset.mediaPreview = pathInput.name;
    empty.textContent = 'No image selected';
    preview.replaceWith(empty);
  }

  removeButton?.remove();
}

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

document.querySelector('[data-bulk-apply]')?.addEventListener('click', () => {
  const action = document.querySelector('[data-bulk-action]')?.value;
  const selected = rowChecks().filter((box) => box.checked);
  if (!action || !selected.length) return;
  if (action === 'delete' && confirm(`Move ${selected.length} item(s) to trash?`)) {
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

function syncThemePreview() {
  const preview = document.querySelector('[data-theme-preview]');
  if (!preview) return;
  const primary = document.querySelector('[data-preview-primary]')?.value || '#2271b1';
  const secondary = document.querySelector('[data-preview-secondary]')?.value || '#50575e';
  const bg = document.querySelector('[data-preview-bg]')?.value || '#ffffff';
  const text = document.querySelector('[data-preview-text]')?.value || '#1d2327';
  const link = document.querySelector('[data-preview-link]')?.value || primary;
  const button = document.querySelector('[data-preview-button-color]')?.value || primary;
  preview.style.setProperty('--preview-primary', primary);
  preview.style.setProperty('--preview-secondary', secondary);
  preview.style.setProperty('--preview-bg', bg);
  preview.style.setProperty('--preview-text', text);
  preview.style.setProperty('--preview-link', link);
  preview.querySelector('[data-preview-header]')?.style.setProperty('background', primary);
  preview.querySelector('[data-preview-heading]')?.style.setProperty('color', primary);
  const previewButton = preview.querySelector('[data-preview-button]');
  if (previewButton) {
    previewButton.style.setProperty('background', button);
    previewButton.style.setProperty('border-color', button);
  }
  preview.querySelector('[data-preview-link-sample]')?.style.setProperty('color', link);
}

document.querySelectorAll('[data-preview-primary], [data-preview-secondary], [data-preview-bg], [data-preview-text], [data-preview-link], [data-preview-button-color]').forEach((input) => {
  input.addEventListener('input', syncThemePreview);
});

document.querySelector('[data-preview-primary]')?.addEventListener('change', () => {
  const primary = document.querySelector('[data-preview-primary]')?.value;
  const link = document.querySelector('[data-preview-link]');
  const button = document.querySelector('[data-preview-button-color]');
  if (link && !link.dataset.userEdited) link.value = primary;
  if (button && !button.dataset.userEdited) button.value = primary;
  syncThemePreview();
});

document.querySelector('[data-preview-link]')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });
document.querySelector('[data-preview-button-color]')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });

document.querySelectorAll('[data-theme-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-theme-preset]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const primary = document.querySelector('[data-preview-primary]');
    const secondary = document.querySelector('[data-preview-secondary]');
    const bg = document.querySelector('[data-preview-bg]');
    const text = document.querySelector('[data-preview-text]');
    const link = document.querySelector('[data-preview-link]');
    const buttonColor = document.querySelector('[data-preview-button-color]');
    if (primary) primary.value = button.dataset.primary;
    if (secondary) secondary.value = button.dataset.secondary;
    if (bg) bg.value = button.dataset.bg;
    if (text) text.value = button.dataset.text;
    if (link) { link.value = button.dataset.primary; delete link.dataset.userEdited; }
    if (buttonColor) { buttonColor.value = button.dataset.primary; delete buttonColor.dataset.userEdited; }
    syncThemePreview();
  });
});

document.querySelectorAll('[data-preview-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.previewMode;
    document.querySelectorAll('[data-preview-mode]').forEach((item) => {
      item.classList.toggle('active', item === btn);
      item.setAttribute('aria-selected', item === btn ? 'true' : 'false');
    });
    const mock = document.querySelector('[data-theme-preview]');
    const iframe = document.querySelector('[data-theme-preview-iframe]');
    if (mock) mock.classList.toggle('is-hidden', mode === 'iframe');
    if (iframe) iframe.classList.toggle('is-active', mode === 'iframe');
  });
});

const fontSelect = document.querySelector('[data-font-select]');
const fontCustom = document.querySelector('[data-font-custom]');
if (fontSelect && fontCustom) {
  fontSelect.addEventListener('change', () => {
    if (fontSelect.value === '__custom__') {
      fontCustom.classList.remove('d-none');
      fontSelect.removeAttribute('name');
      fontCustom.setAttribute('name', 'font_family');
    } else {
      fontCustom.classList.add('d-none');
      fontCustom.removeAttribute('name');
      fontSelect.setAttribute('name', 'font_family');
    }
  });
  if (fontSelect.value === '__custom__') {
    fontCustom.classList.remove('d-none');
    fontSelect.removeAttribute('name');
    fontCustom.setAttribute('name', 'font_family');
  }
}

document.querySelector('[data-theme-customizer]')?.addEventListener('submit', (event) => {
  const form = event.target;
  const cssField = form.querySelector('#custom_css');
  const link = form.querySelector('[data-preview-link]')?.value || form.querySelector('[data-preview-primary]')?.value;
  const button = form.querySelector('[data-preview-button-color]')?.value || form.querySelector('[data-preview-primary]')?.value;
  if (!cssField) return;
  const css = cssField.value.replace(/\/\* np-theme-vars \*\/[\s\S]*?\}\s*/g, '').trim();
  const vars = `/* np-theme-vars */\n:root { --site-link: ${link}; --site-button: ${button}; }`;
  cssField.value = css ? `${vars}\n\n${css}` : vars;
});

syncThemePreview();
