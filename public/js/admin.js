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
