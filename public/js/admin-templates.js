(function () {
  const searchInput = document.querySelector('[data-template-filter]');
  const statusFilter = document.querySelector('[data-template-status]');
  const visibleCountEl = document.querySelector('[data-template-visible-count]');
  const previewModalEl = document.getElementById('npTemplatePreviewModal');
  const previewTitleEl = document.querySelector('[data-template-preview-title]');
  const previewBodyEl = document.querySelector('[data-template-preview-body]');

  function activePanelCards() {
    const activePane = document.querySelector('.tab-pane.active');
    return activePane ? [...activePane.querySelectorAll('[data-template-card]')] : [];
  }

  function applyFilters() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const status = statusFilter?.value || 'all';
    const cards = activePanelCards();
    let visible = 0;

    cards.forEach((card) => {
      const name = card.getAttribute('data-name') || '';
      const cardStatus = card.getAttribute('data-status') || '';
      const matchesQuery = !query || name.includes(query);
      const matchesStatus = status === 'all' || cardStatus === status;
      const show = matchesQuery && matchesStatus;
      card.classList.toggle('d-none', !show);
      if (show) visible += 1;
    });

    if (visibleCountEl) visibleCountEl.textContent = String(visible);
  }

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);

  document.querySelectorAll('[data-bs-toggle="tab"]').forEach((tab) => {
    tab.addEventListener('shown.bs.tab', applyFilters);
  });

  document.querySelectorAll('[data-template-preview-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (!previewModalEl || !window.bootstrap) return;
      const title = trigger.getAttribute('data-preview-title') || 'Preview';
      const encoded = trigger.getAttribute('data-preview-html') || '';
      let html = '';
      try {
        html = decodeURIComponent(encoded);
      } catch {
        html = encoded;
      }
      if (previewTitleEl) previewTitleEl.textContent = title;
      if (previewBodyEl) previewBodyEl.innerHTML = html || '<p class="text-muted mb-0">No content to preview.</p>';
      window.bootstrap.Modal.getOrCreateInstance(previewModalEl).show();
    });
  });

  applyFilters();

  const form = document.querySelector('[data-template-edit-form]');
  if (!form) return;

  const visualPanel = form.querySelector('[data-template-visual-editor]');
  const jsonPanel = form.querySelector('[data-template-json-editor]');
  const previewPanel = form.querySelector('[data-template-preview-panel]');
  const jsonTextarea = form.querySelector('[data-template-json-textarea]');
  const hiddenJsonInput = form.querySelector('[data-block-json-input]');
  const toggles = form.querySelectorAll('[data-template-editor-toggle]');

  function syncJsonFromVisual() {
    if (hiddenJsonInput && jsonTextarea) {
      jsonTextarea.value = hiddenJsonInput.value || '[]';
    }
  }

  function syncVisualFromJson() {
    if (!hiddenJsonInput || !jsonTextarea) return;
    hiddenJsonInput.value = jsonTextarea.value || '[]';
    const editorEl = form.querySelector('[data-block-editor]');
    if (editorEl && editorEl.__npBlockEditor) {
      try {
        editorEl.__npBlockEditor.setBlocks(JSON.parse(hiddenJsonInput.value || '[]'));
      } catch {
        /* invalid JSON — visual editor unchanged until fixed */
      }
    }
  }

  function setEditorView(view) {
    if (visualPanel) visualPanel.classList.toggle('d-none', view !== 'visual');
    if (jsonPanel) jsonPanel.classList.toggle('d-none', view !== 'json');
    if (previewPanel) previewPanel.classList.toggle('d-none', view !== 'preview');

    if (view === 'json') syncJsonFromVisual();
    if (view === 'visual') syncVisualFromJson();
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener('change', () => {
      if (toggle.checked) setEditorView(toggle.value);
    });
  });

  form.addEventListener('submit', () => {
    const activeToggle = form.querySelector('[data-template-editor-toggle]:checked');
    if (activeToggle?.value === 'json') {
      if (hiddenJsonInput && jsonTextarea) hiddenJsonInput.value = jsonTextarea.value;
    } else {
      syncJsonFromVisual();
    }
  });
})();
