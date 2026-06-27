(function () {
  const form = document.querySelector('[data-autosave-form]');
  if (!form) return;

  const resourceType = form.dataset.resourceType;
  const resourceId = form.dataset.resourceId;
  if (!resourceType) return;

  const statusEl = document.querySelector('[data-autosave-status]');
  let timer = null;
  let restored = false;
  const localKey = `np-autosave:${resourceType}:${resourceId || 'new'}`;

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
    if (draft.block_content_json) {
      const editorEl = document.querySelector('[data-block-editor]');
      if (editorEl?.__npBlockEditor?.setBlocks) {
        try {
          const blocks = typeof draft.block_content_json === 'string'
            ? JSON.parse(draft.block_content_json)
            : draft.block_content_json;
          editorEl.__npBlockEditor.setBlocks(Array.isArray(blocks) ? blocks : []);
        } catch {
          // ignore invalid block JSON
        }
      }
    }
  }

  function loadLocalDraft() {
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.draft_data || parsed;
    } catch {
      return null;
    }
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(localKey, JSON.stringify({ draft_data: collectDraft(), saved_at: new Date().toISOString() }));
    } catch {
      // ignore quota errors
    }
  }

  function clearLocalDraft() {
    try { localStorage.removeItem(localKey); } catch { /* ignore */ }
  }

  async function loadDraft() {
    if (!resourceId) {
      const local = loadLocalDraft();
      if (!local || !local.title) return;
      const shouldRestore = window.confirm('Recover unsaved changes from your browser draft?');
      if (!shouldRestore) return;
      applyDraft(local);
      restored = true;
      if (statusEl) statusEl.textContent = 'Recovered local draft';
      return;
    }
    try {
      const csrf = form.querySelector('[name="_csrf"]')?.value;
      const res = await fetch(`/admin/autosave?resource_type=${encodeURIComponent(resourceType)}&resource_id=${encodeURIComponent(resourceId)}`, {
        headers: { 'CSRF-Token': csrf, 'X-CSRF-Token': csrf }
      });
      if (!res.ok) return;
      const payload = await res.json();
      if (!payload?.draft) return;
      const draft = payload.draft.draft_data || payload.draft;
      if (!draft || typeof draft !== 'object') return;
      const shouldRestore = window.confirm('Recover unsaved changes from your last autosave?');
      if (!shouldRestore) return;
      applyDraft(draft);
      restored = true;
      if (statusEl) statusEl.textContent = 'Recovered autosaved draft';
    } catch {
      // ignore restore errors
    }
  }

  async function saveDraft() {
    if (!resourceId) {
      saveLocalDraft();
      if (statusEl) {
        statusEl.textContent = 'Draft saved locally ' + (window.npFormatTime ? window.npFormatTime(new Date()) : new Date().toLocaleTimeString());
      }
      return;
    }
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

  function showConflictWarning(resource) {
    if (document.querySelector('[data-autosave-conflict]')) return;
    const banner = document.createElement('div');
    banner.className = 'alert alert-warning mb-3';
    banner.setAttribute('data-autosave-conflict', '1');
    banner.setAttribute('role', 'alert');
    const editor = resource?.updated_by_name || 'another user';
    banner.textContent = `Editing conflict: this content was updated by ${editor}. Review changes before saving.`;
    form.prepend(banner);
    if (statusEl) statusEl.textContent = 'Conflict detected — review before saving';
  }

  async function checkConflict() {
    if (!resourceId || !form.dataset.resourceUpdatedAt) return;
    try {
      const csrf = form.querySelector('[name="_csrf"]')?.value;
      const res = await fetch(`/admin/autosave?resource_type=${encodeURIComponent(resourceType)}&resource_id=${encodeURIComponent(resourceId)}`, {
        headers: { 'CSRF-Token': csrf, 'X-CSRF-Token': csrf }
      });
      if (!res.ok) return;
      const payload = await res.json();
      if (!payload?.resource?.updated_at) return;
      const serverTs = new Date(payload.resource.updated_at).getTime();
      const baselineTs = new Date(form.dataset.resourceUpdatedAt).getTime();
      if (!Number.isFinite(serverTs) || !Number.isFinite(baselineTs) || serverTs <= baselineTs) return;
      const currentUserId = form.dataset.currentUserId || '';
      if (String(payload.resource.updated_by) === String(currentUserId)) return;
      showConflictWarning(payload.resource);
    } catch {
      // ignore polling errors
    }
  }

  form.addEventListener('input', () => {
    if (restored) restored = false;
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveDraft, 30000);
    if (statusEl) statusEl.textContent = 'Unsaved changes…';
  });

  form.addEventListener('submit', async () => {
    clearLocalDraft();
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
  if (resourceId && form.dataset.resourceUpdatedAt) {
    setInterval(checkConflict, 60000);
  }
})();
