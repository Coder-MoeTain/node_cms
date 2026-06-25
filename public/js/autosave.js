(function () {
  const form = document.querySelector('[data-autosave-form]');
  if (!form) return;

  const resourceType = form.dataset.resourceType;
  const resourceId = form.dataset.resourceId;
  if (!resourceType) return;

  const statusEl = document.querySelector('[data-autosave-status]');
  let timer = null;

  function collectDraft() {
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    return data;
  }

  async function saveDraft() {
    try {
      const csrf = form.querySelector('[name="_csrf"]')?.value;
      const res = await fetch('/admin/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId || 0, draft_data: collectDraft() })
      });
      if (res.ok && statusEl) {
        statusEl.textContent = 'Draft saved ' + new Date().toLocaleTimeString();
      }
    } catch {
      if (statusEl) statusEl.textContent = 'Autosave failed';
    }
  }

  form.addEventListener('input', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveDraft, 30000);
    if (statusEl) statusEl.textContent = 'Unsaved changes…';
  });

  window.addEventListener('beforeunload', (e) => {
    if (statusEl?.textContent?.includes('Unsaved')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
