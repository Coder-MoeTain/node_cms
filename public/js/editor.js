function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

document.querySelectorAll('[data-slug-source]').forEach((titleInput) => {
  const slugInput = document.querySelector('[data-slug-target]');
  if (!slugInput) return;
  titleInput.addEventListener('input', () => {
    if (slugInput.dataset.manual === 'true') return;
    slugInput.value = slugify(titleInput.value);
    updatePermalinkPreview();
  });
  slugInput.addEventListener('input', () => {
    slugInput.dataset.manual = 'true';
    updatePermalinkPreview();
  });
});

function updatePermalinkPreview() {
  const slugInput = document.querySelector('[data-slug-target]');
  const preview = document.querySelector('[data-permalink-preview]');
  if (!slugInput || !preview) return;
  const base = preview.dataset.base || '';
  preview.textContent = `${base}${slugInput.value || 'sample-post'}`;
}

updatePermalinkPreview();

document.querySelectorAll('[data-metabox-toggle]').forEach((header) => {
  header.addEventListener('click', () => {
    const body = header.nextElementSibling;
    if (!body) return;
    body.hidden = !body.hidden;
    header.setAttribute('aria-expanded', body.hidden ? 'false' : 'true');
  });
});

document.querySelectorAll('[data-open-media-picker]').forEach((button) => {
  button.addEventListener('click', () => {
    const field = button.dataset.openMediaPicker;
    if (typeof activeMediaTargetField !== 'undefined') {
      activeMediaTargetField = field;
    } else {
      window.activeMediaTargetField = field;
    }
    const modal = document.getElementById('mediaGalleryModal');
    if (modal && window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(modal).show();
      if (typeof loadMediaGallery === 'function') loadMediaGallery();
    }
  });
});
