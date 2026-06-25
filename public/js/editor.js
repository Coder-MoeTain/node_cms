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
  editorForm.addEventListener('submit', () => {
    if (window.tinymce) tinymce.triggerSave();
    dirty = false;
  });
  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function hideTinyMceImageSourceField() {
  const dialog = document.querySelector('.tox-dialog');
  if (!dialog) return;
  dialog.querySelectorAll('.tox-form__group').forEach((group) => {
    const label = group.querySelector('label');
    const input = group.querySelector('input');
    if (!label || !input) return;
    const labelText = label.textContent.trim().toLowerCase();
    if (labelText === 'source' || labelText === 'url' || input.type === 'url') {
      group.style.display = 'none';
    }
  });
}

if (window.tinymce && document.querySelector('.rich-editor')) {
  tinymce.init({
    selector: '.rich-editor',
    license_key: 'gpl',
    base_url: '/vendor/tinymce',
    suffix: '.min',
    height: 420,
    menubar: false,
    plugins: 'link image media table lists code autoresize',
    toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image media | code',
    automatic_uploads: true,
    paste_data_images: true,
    image_uploadtab: true,
    images_file_types: 'jpg,jpeg,png,gif,webp',
    file_picker_types: 'image',
    images_upload_handler: (blobInfo, progress) => new Promise((resolve, reject) => {
      if (typeof window.npUploadImage !== 'function') {
        reject(new Error('Upload is not available.'));
        return;
      }
      const blob = blobInfo.blob();
      const file = new File([blob], blobInfo.filename(), { type: blob.type });
      window.npUploadImage(file)
        .then((data) => resolve(data.location))
        .catch((error) => reject(error.message || 'Upload failed.'));
    }),
    file_picker_callback: (callback) => {
      window.npOpenMediaPicker((item) => {
        callback(item.filePath, { alt: item.originalName || '' });
      });
    },
    setup(editor) {
      editor.on('ExecCommand', (event) => {
        if (event.command === 'mceImage') {
          setTimeout(hideTinyMceImageSourceField, 50);
        }
      });
    }
  });
}
