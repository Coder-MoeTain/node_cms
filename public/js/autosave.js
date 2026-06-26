(function () {
  const form = document.querySelector('[data-autosave-form]');
  if (!form) return;

  const resourceType = form.dataset.resourceType;
  const resourceId = form.dataset.resourceId;
  if (!resourceType) return;

  const statusEl = document.querySelector('[data-autosave-status]');
  let timer = null;
  let restored = false;

  function collectDraft() {
    const data = {};
    new FormData(form).forEach((value, key) => { data[key] = value; });
    return data;
  }

  function applyDraft(draft) {
    if (!draft || typeof draft !== 'object') return;
    Object.entries(draft).forEach(([key, value]) => {
      const field = form.elements.namedItem(key);
      if (!field) return;
      if (field.type === 'checkbox') {
        field.checked = value === 'on' || value === true || value === 'true';
      } else if (field.type === 'radio') {
        const radio = form.querySelector(`[name="${key}"][value="${value}"]`);
        if (radio) radio.checked = true;
      } else {
        field.value = value == null ? '' : String(value);
      }
    });
    form.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function loadDraft() {
    if (!resourceId) return;
    try {
      const csrf = form.querySelector('[name="_csrf"]')?.value;
      const res = await fetch(`/admin/autosave?resource_type=${encodeURIComponent(resourceType)}&resource_id=${encodeURIComponent(resourceId)}`, {
        headers: { 'CSRF-Token': csrf, 'X-CSRF-Token': csrf }
      });
      if (!res.ok) return;
      const payload = await res.json();
      if (!payload?.draft?.draft_data) return;
      const shouldRestore = window.confirm('Recover unsaved changes from your last autosave?');
      if (!shouldRestore) return;
      applyDraft(payload.draft.draft_data);
      restored = true;
      if (statusEl) statusEl.textContent = 'Recovered autosaved draft';
    } catch {
      // ignore restore errors
    }
  }

  async function saveDraft() {
    if (!resourceId) return;
    try {
      const csrf = form.querySelector('[name="_csrf"]')?.value;
      const res = await fetch('/admin/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId || 0, draft_data: collectDraft() })
      });
      if (res.ok && statusEl) {
        statusEl.textContent = 'Draft saved ' + (window.npFormatTime ? window.npFormatTime(new Date()) : (window.npFormatDateTime ? window.npFormatDateTime(new Date(), { year: undefined, month: undefined, day: undefined }) : new Date().toLocaleTimeString()));
      }
    } catch {
      if (statusEl) statusEl.textContent = 'Autosave failed';
    }
  }

  form.addEventListener('input', () => {
    if (restored) restored = false;
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveDraft, 30000);
    if (statusEl) statusEl.textContent = 'Unsaved changes…';
  });

  form.addEventListener('submit', async () => {
    if (!resourceId) return;
    try {
      const csrf = form.querySelector('[name="_csrf"]')?.value;
      await fetch('/admin/autosave', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'CSRF-Token': csrf, 'X-CSRF-Token': csrf },
        body: JSON.stringify({ resource_type: resourceType, resource_id: resourceId })
      });
    } catch {
      // ignore cleanup errors
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (statusEl?.textContent?.includes('Unsaved')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  loadDraft();
})();
