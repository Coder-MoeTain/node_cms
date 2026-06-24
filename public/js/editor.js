function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function updatePermalinkPreview() {
  const slugInput = document.querySelector('[data-slug-target]');
  const display = document.querySelector('[data-permalink-display]');
  const permalinkInput = document.querySelector('[data-permalink-input]');
  const slug = slugInput?.value || 'sample-post';
  const base = display?.textContent?.split(slug)[0] || '/post/';
  if (display) display.textContent = `${base.replace(/\/$/, '')}/${slug}`.replace('//', '/');
  if (permalinkInput && document.activeElement !== permalinkInput) permalinkInput.value = slug;
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

updatePermalinkPreview();

document.querySelector('[data-permalink-edit]')?.addEventListener('click', () => {
  document.querySelector('[data-permalink-editor]')?.classList.remove('d-none');
  document.querySelector('[data-permalink-display]')?.classList.add('d-none');
  document.querySelector('[data-permalink-edit]')?.classList.add('d-none');
});

document.querySelector('[data-permalink-save]')?.addEventListener('click', () => {
  const slugInput = document.querySelector('[data-slug-target]');
  const permalinkInput = document.querySelector('[data-permalink-input]');
  if (slugInput && permalinkInput) {
    slugInput.value = slugify(permalinkInput.value);
    slugInput.dataset.manual = 'true';
    updatePermalinkPreview();
  }
  document.querySelector('[data-permalink-editor]')?.classList.add('d-none');
  document.querySelector('[data-permalink-display]')?.classList.remove('d-none');
  document.querySelector('[data-permalink-edit]')?.classList.remove('d-none');
});

document.querySelector('[data-permalink-cancel]')?.addEventListener('click', () => {
  document.querySelector('[data-permalink-editor]')?.classList.add('d-none');
  document.querySelector('[data-permalink-display]')?.classList.remove('d-none');
  document.querySelector('[data-permalink-edit]')?.classList.remove('d-none');
});

document.querySelectorAll('[data-metabox-toggle]').forEach((header) => {
  header.addEventListener('click', () => {
    const body = header.nextElementSibling;
    if (!body) return;
    body.hidden = !body.hidden;
    header.setAttribute('aria-expanded', body.hidden ? 'false' : 'true');
  });
});

document.querySelector('[data-save-draft]')?.addEventListener('click', () => {
  const status = document.querySelector('[name="status"]');
  if (status) status.value = 'draft';
});

const editorForm = document.querySelector('[data-editor-form]');
if (editorForm) {
  let dirty = false;
  editorForm.addEventListener('input', () => { dirty = true; });
  editorForm.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

document.addEventListener('click', (event) => {
  const picker = event.target.closest('[data-open-media-picker]');
  if (!picker) return;
  const field = picker.dataset.openMediaPicker;
  window.activeMediaTargetField = field;
  if (typeof activeMediaTargetField !== 'undefined') {
    try { activeMediaTargetField = field; } catch (e) { /* legacy */ }
  }
  const modal = document.getElementById('mediaGalleryModal');
  if (modal && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modal).show();
    if (typeof loadMediaGallery === 'function') loadMediaGallery();
  }
});
