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
