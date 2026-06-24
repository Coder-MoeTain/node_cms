document.querySelectorAll('[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!confirm(form.dataset.confirm || 'Are you sure?')) event.preventDefault();
  });
});

document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => {
  document.querySelector('.admin-sidebar')?.classList.toggle('open');
});

document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const html = document.documentElement;
  html.dataset.bsTheme = html.dataset.bsTheme === 'dark' ? 'light' : 'dark';
});

if (window.tinymce) {
  tinymce.init({
    selector: '.rich-editor',
    license_key: 'gpl',
    height: 420,
    plugins: 'link image media table lists code',
    toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist | link image media | code'
  });
}

document.querySelector('[data-preview-file]')?.addEventListener('change', (event) => {
  const preview = document.querySelector('.upload-preview');
  preview.innerHTML = '';
  [...event.target.files].forEach((file) => {
    const item = document.createElement('span');
    item.className = 'badge text-bg-light me-1';
    item.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
    preview.appendChild(item);
  });
});

let activeMediaTargetField = null;

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
  image.src = filePath;
  image.alt = `${fieldName} preview`;
  previewContainer.replaceWith(image);
}

function selectMediaItem(item) {
  if (!activeMediaTargetField) return;
  const input = document.querySelector(`[name="${activeMediaTargetField}"]`);
  if (!input) return;

  input.value = item.filePath;
  updateMediaPreview(activeMediaTargetField, item.filePath);
  bootstrap.Modal.getInstance(document.getElementById('mediaGalleryModal'))?.hide();
}

async function loadMediaGallery() {
  const grid = document.querySelector('[data-media-gallery-grid]');
  if (!grid) return;

  grid.innerHTML = '<div class="media-gallery-loading">Loading media...</div>';
  try {
    const response = await fetch('/admin/settings/media-gallery?type=image', {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();

    if (!data.items?.length) {
      grid.innerHTML = '<div class="media-gallery-empty">No images found. Upload images in Media Library first.</div>';
      return;
    }

    grid.innerHTML = '';
    data.items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-gallery-item';
      button.innerHTML = `
        <img src="${item.filePath}" alt="${item.originalName}">
        <span>${item.originalName}</span>
      `;
      button.addEventListener('click', () => selectMediaItem(item));
      grid.appendChild(button);
    });
  } catch (error) {
    grid.innerHTML = '<div class="media-gallery-empty">Unable to load media gallery.</div>';
  }
}

document.querySelectorAll('[data-open-media-gallery]').forEach((button) => {
  button.addEventListener('click', async () => {
    activeMediaTargetField = button.dataset.targetField;
    const modal = new bootstrap.Modal(document.getElementById('mediaGalleryModal'));
    modal.show();
    await loadMediaGallery();
  });
});
