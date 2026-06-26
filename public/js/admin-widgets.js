(function () {
  const definitions = window.NP_WIDGET_DEFINITIONS || {};
  const menus = window.NP_WIDGET_MENUS || [];
  const typeInput = document.getElementById('add-widget-type');
  const titleInput = document.getElementById('add-widget-title');
  const titleDisplay = document.getElementById('add-widget-title-display');
  const fieldsRoot = document.getElementById('add-widget-fields');
  if (!typeInput || !fieldsRoot) return;

  function fieldHtml(field, prefix) {
    const id = `${prefix}-${field.name}`;
    if (field.type === 'checkbox') {
      const checked = field.default ? 'checked' : '';
      return `<label class="form-check mb-2"><input class="form-check-input" type="checkbox" name="${field.name}" id="${id}" ${checked}><span class="form-check-label">${field.label}</span></label>`;
    }
    if (field.type === 'menu') {
      const options = menus.map((menu) => `<option value="${menu.slug}"${menu.slug === field.default ? ' selected' : ''}>${menu.name}</option>`).join('');
      return `<div class="mb-2"><label class="form-label" for="${id}">${field.label}</label><select class="form-select" name="${field.name}" id="${id}">${options}</select></div>`;
    }
    if (field.type === 'textarea') {
      return `<div class="mb-2"><label class="form-label" for="${id}">${field.label}</label><textarea class="form-control" name="${field.name}" id="${id}" rows="${field.rows || 4}"></textarea></div>`;
    }
    const inputType = field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text';
    const attrs = [];
    if (field.min != null) attrs.push(`min="${field.min}"`);
    if (field.max != null) attrs.push(`max="${field.max}"`);
    if (field.default != null && field.type !== 'number') attrs.push(`value="${String(field.default).replace(/"/g, '&quot;')}"`);
    if (field.type === 'number' && field.default != null) attrs.push(`value="${field.default}"`);
    return `<div class="mb-2"><label class="form-label" for="${id}">${field.label}</label><input class="form-control" type="${inputType}" name="${field.name}" id="${id}" ${attrs.join(' ')}></div>`;
  }

  function renderAddForm(type) {
    const def = definitions[type] || definitions.text;
    typeInput.value = type;
    const titleField = def.fields.find((f) => f.name === 'title');
    const titleValue = titleField?.default || def.defaultTitle || def.label;
    titleInput.value = titleValue;
    titleDisplay.value = def.label;
    fieldsRoot.innerHTML = def.fields
      .filter((f) => f.name !== 'title')
      .map((f) => fieldHtml(f, 'add-widget'))
      .join('');
  }

  document.querySelectorAll('[data-widget-type]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-widget-type]').forEach((el) => el.classList.remove('active'));
      button.classList.add('active');
      renderAddForm(button.dataset.widgetType);
    });
  });

  const initial = document.querySelector('[data-widget-type]');
  if (initial) {
    initial.classList.add('active');
    renderAddForm(initial.dataset.widgetType);
  }
})();
