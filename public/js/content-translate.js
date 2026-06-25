function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content
    || document.querySelector('input[name="_csrf"]')?.value
    || '';
}

function getMainContentTextarea(form) {
  return form.querySelector('[data-main-content-editor]')
    || form.querySelector('textarea[name="content"]');
}

function readMainEditorContent(form) {
  const textarea = getMainContentTextarea(form);
  if (!textarea) return '';
  if (window.tinymce && typeof tinymce.triggerSave === 'function') {
    tinymce.triggerSave();
  }
  return textarea.value || '';
}

function findTranslationField(form, locale, field) {
  const panel = form.querySelector(`[data-translation-locale="${locale}"]`);
  if (panel) {
    const inPanel = panel.querySelector(`[data-translation-field="${field}"]`);
    if (inPanel) return inPanel;
  }
  const name = `tr[${locale}][${field}]`;
  if (form.elements && typeof form.elements.namedItem === 'function') {
    const named = form.elements.namedItem(name);
    if (named) return named;
  }
  return Array.from(form.querySelectorAll('[data-translation-field]')).find((el) => el.name === name) || null;
}

function setTranslationField(form, locale, field, value) {
  const el = findTranslationField(form, locale, field);
  if (!el) return;
  el.value = value || '';
}

function collectSourceFields(form) {
  return {
    title: form.querySelector('[name="title"]')?.value?.trim() || '',
    excerpt: form.querySelector('[name="excerpt"]')?.value?.trim() || '',
    content: readMainEditorContent(form).trim(),
    seo_title: form.querySelector('[name="seo_title"]')?.value?.trim() || '',
    seo_description: form.querySelector('[name="seo_description"]')?.value?.trim() || ''
  };
}

function setStatus(toolbar, message, isError = false) {
  const status = toolbar.querySelector('[data-translate-status]');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('text-danger', isError);
  status.classList.toggle('text-success', !isError && Boolean(message));
}

async function autoFillTranslations(button) {
  const toolbar = button.closest('[data-content-translate-toolbar]');
  const form = button.closest('form');
  const translationsPanel = form?.querySelector('[data-content-translations]');
  if (!toolbar || !form || !translationsPanel) return;

  const fields = collectSourceFields(form);
  if (!fields.title && !fields.content && !fields.excerpt) {
    setStatus(toolbar, 'Add a title or content first.', true);
    return;
  }

  const sourceLocale = toolbar.querySelector('[data-translate-source-locale]')?.value || 'en';
  const csrf = getCsrfToken();
  button.disabled = true;
  setStatus(toolbar, 'Translating…');

  try {
    const response = await fetch('/admin/translate-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify({ source_locale: sourceLocale, fields })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Translation failed.');
    }

    const translationFields = ['title', 'excerpt', 'content', 'seo_title', 'seo_description'];
    let filledCount = 0;
    Object.entries(data.translations || {}).forEach(([locale, row]) => {
      translationFields.forEach((field) => {
        const value = row[field] || '';
        if (!value) return;
        const before = findTranslationField(form, locale, field)?.value || '';
        setTranslationField(form, locale, field, value);
        if (before !== value) filledCount += 1;
      });
    });

    if (!filledCount) {
      setStatus(toolbar, 'No translation fields were updated. Check the source language matches your post text.', true);
      return;
    }

    setStatus(toolbar, 'Translations filled. Review each language tab, then click Update to save.');
    form.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (error) {
    setStatus(toolbar, error.message || 'Translation failed.', true);
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll('[data-auto-translate]').forEach((button) => {
  button.addEventListener('click', () => {
    autoFillTranslations(button);
  });
});
