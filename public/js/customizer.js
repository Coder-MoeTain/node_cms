/**
 * NodePress Theme Customizer — live preview, presets, portal config, save handling
 */
(function () {
  const form = document.querySelector('[data-theme-customizer]');
  if (!form) return;

  const preview = document.querySelector('[data-theme-preview]');
  const iframe = document.querySelector('[data-theme-preview-iframe]');

  function syncThemePreview() {
    if (!preview) return;
    const primary = document.querySelector('[data-preview-primary]')?.value || '#2271b1';
    const secondary = document.querySelector('[data-preview-secondary]')?.value || '#50575e';
    const bg = document.querySelector('[data-preview-bg]')?.value || '#ffffff';
    const text = document.querySelector('[data-preview-text]')?.value || '#1d2327';
    const link = document.querySelector('[data-preview-link]')?.value || primary;
    const button = document.querySelector('[data-preview-button-color]')?.value || primary;
    const accent = document.querySelector('[data-preview-accent]')?.value || '#d71920';
    const footer = document.querySelector('[data-preview-footer]')?.value || '#0b2f47';
    const fontSelect = document.querySelector('[data-font-select]');
    const fontCustom = document.querySelector('[data-font-custom]');
    const font = fontSelect?.value === '__custom__' ? fontCustom?.value : fontSelect?.value;

    preview.style.setProperty('--preview-primary', primary);
    preview.style.setProperty('--preview-secondary', secondary);
    preview.style.setProperty('--preview-bg', bg);
    preview.style.setProperty('--preview-text', text);
    preview.style.setProperty('--preview-link', link);
    preview.style.setProperty('--preview-button', button);
    preview.style.setProperty('--preview-accent', accent);
    if (font) preview.style.setProperty('--preview-font', font);
    preview.style.background = bg;
    preview.style.color = text;

    const header = preview.querySelector('[data-preview-header]');
    if (header) {
      header.style.background = primary;
      header.style.borderBottom = `3px solid ${secondary}`;
    }
    preview.querySelector('[data-preview-heading]')?.style.setProperty('color', primary);
    const previewButton = preview.querySelector('[data-preview-button]');
    if (previewButton) {
      previewButton.style.setProperty('background', button);
      previewButton.style.setProperty('border-color', button);
    }
    preview.querySelector('[data-preview-link-sample]')?.style.setProperty('color', link);
    preview.querySelector('[data-preview-footer-bar]')?.style.setProperty('background', footer);
    preview.querySelector('[data-preview-accent-sample]')?.style.setProperty('color', accent);

    const logoInput = document.querySelector('[name="logo"]');
    const logoPreview = preview.querySelector('[data-preview-logo]');
    if (logoPreview && logoInput?.value) {
      logoPreview.src = logoInput.value;
      logoPreview.hidden = false;
    }

    const faviconInput = document.querySelector('[name="favicon"]');
    const faviconPreview = preview.querySelector('[data-preview-favicon]');
    if (faviconPreview && faviconInput?.value) {
      faviconPreview.src = faviconInput.value;
      faviconPreview.hidden = false;
    }
  }

  function syncIdentityPreviews() {
    const logoPath = document.querySelector('[name="logo"]')?.value;
    const faviconPath = document.querySelector('[name="favicon"]')?.value;
    const logoImg = document.querySelector('[data-logo-preview]');
    const faviconImg = document.querySelector('[data-favicon-preview]');
    if (logoImg) {
      if (logoPath) {
        logoImg.src = logoPath;
        logoImg.hidden = false;
      } else {
        logoImg.hidden = true;
      }
    }
    if (faviconImg) {
      if (faviconPath) {
        faviconImg.src = faviconPath;
        faviconImg.hidden = false;
      } else {
        faviconImg.hidden = true;
      }
    }
    syncThemePreview();
  }

  function buildPortalConfig() {
    const config = { preset: 'classic-blue', header: {}, nav: {}, homepage: {}, widgets: {} };
    const activePreset = document.querySelector('[data-theme-preset].active');
    if (activePreset) config.preset = activePreset.dataset.themePreset || config.preset;

    document.querySelectorAll('[data-portal-opt]').forEach((input) => {
      const path = input.dataset.portalOpt.split('.');
      let node = config;
      for (let i = 0; i < path.length - 1; i++) {
        if (!node[path[i]]) node[path[i]] = {};
        node = node[path[i]];
      }
      node[path[path.length - 1]] = input.checked;
    });

    document.querySelectorAll('[data-portal-opt-select]').forEach((select) => {
      const path = select.dataset.portalOptSelect.split('.');
      let node = config;
      for (let i = 0; i < path.length - 1; i++) {
        if (!node[path[i]]) node[path[i]] = {};
        node = node[path[i]];
      }
      node[path[path.length - 1]] = select.value;
    });

    const headerLayout = document.querySelector('[data-portal-header-layout]');
    if (headerLayout?.value === 'portal') {
      config.header.layout = 'portal';
    }

    return config;
  }

  const colorInputs = '[data-preview-primary], [data-preview-secondary], [data-preview-bg], [data-preview-text], [data-preview-link], [data-preview-button-color], [data-preview-accent], [data-preview-card], [data-preview-footer], [data-preview-muted]';
  document.querySelectorAll(colorInputs).forEach((input) => {
    input.addEventListener('input', syncThemePreview);
  });

  document.querySelector('[data-preview-primary]')?.addEventListener('change', () => {
    const primary = document.querySelector('[data-preview-primary]')?.value;
    const link = document.querySelector('[data-preview-link]');
    const button = document.querySelector('[data-preview-button-color]');
    if (link && !link.dataset.userEdited) link.value = primary;
    if (button && !button.dataset.userEdited) button.value = primary;
    syncThemePreview();
  });

  document.querySelector('[data-preview-link]')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });
  document.querySelector('[data-preview-button-color]')?.addEventListener('input', (e) => { e.target.dataset.userEdited = '1'; });

  document.querySelectorAll('[data-theme-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-theme-preset]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const set = (sel, val) => {
        const el = document.querySelector(sel);
        if (el && val) el.value = val;
      };
      set('[data-preview-primary]', button.dataset.primary);
      set('[data-preview-secondary]', button.dataset.secondary);
      set('[data-preview-bg]', button.dataset.bg);
      set('[data-preview-text]', button.dataset.text);
      const link = document.querySelector('[data-preview-link]');
      const buttonColor = document.querySelector('[data-preview-button-color]');
      if (link) { link.value = button.dataset.primary; delete link.dataset.userEdited; }
      if (buttonColor) { buttonColor.value = button.dataset.primary; delete buttonColor.dataset.userEdited; }
      if (button.dataset.accent) set('[data-preview-accent]', button.dataset.accent);
      if (button.dataset.card) set('[data-preview-card]', button.dataset.card);
      if (button.dataset.footer) set('[data-preview-footer]', button.dataset.footer);
      if (button.dataset.muted) set('[data-preview-muted]', button.dataset.muted);
      if (button.dataset.headerLayout) {
        const headerSelect = document.querySelector('[data-portal-header-layout]');
        if (headerSelect) headerSelect.value = button.dataset.headerLayout;
      }
      if (button.dataset.themePreset === 'myanmar-portal') {
        document.querySelectorAll('[data-portal-opt]').forEach((input) => {
          input.checked = true;
        });
        const navStyle = document.querySelector('[data-portal-opt-select="nav.style"]');
        if (navStyle) navStyle.value = 'portal';
        const cardStyle = document.querySelector('[data-portal-opt-select="widgets.cardStyle"]');
        if (cardStyle) cardStyle.value = 'shadow';
      }
      syncThemePreview();
    });
  });

  document.querySelectorAll('[data-preview-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.previewMode;
      document.querySelectorAll('[data-preview-mode]').forEach((item) => {
        item.classList.toggle('active', item === btn);
        item.setAttribute('aria-selected', item === btn ? 'true' : 'false');
      });
      if (preview) preview.classList.toggle('is-hidden', mode === 'iframe');
      if (iframe) {
        iframe.classList.toggle('is-active', mode === 'iframe');
        if (mode === 'iframe') iframe.src = iframe.src.split('?')[0] + '?customizer_preview=1&t=' + Date.now();
      }
    });
  });

  const fontSelect = document.querySelector('[data-font-select]');
  const fontCustom = document.querySelector('[data-font-custom]');
  if (fontSelect && fontCustom) {
    const syncFontField = () => {
      if (fontSelect.value === '__custom__') {
        fontCustom.classList.remove('d-none');
        fontSelect.removeAttribute('name');
        fontCustom.setAttribute('name', 'font_family');
      } else {
        fontCustom.classList.add('d-none');
        fontCustom.removeAttribute('name');
        fontSelect.setAttribute('name', 'font_family');
      }
      syncThemePreview();
    };
    fontSelect.addEventListener('change', syncFontField);
    fontCustom.addEventListener('input', syncThemePreview);
    syncFontField();
  }

  document.querySelector('[name="logo"]')?.addEventListener('change', syncIdentityPreviews);
  document.querySelector('[name="favicon"]')?.addEventListener('change', syncIdentityPreviews);

  form.addEventListener('submit', () => {
    const cssField = form.querySelector('#custom_css');
    if (!cssField) return;
    const link = form.querySelector('[data-preview-link]')?.value || form.querySelector('[data-preview-primary]')?.value;
    const button = form.querySelector('[data-preview-button-color]')?.value || form.querySelector('[data-preview-primary]')?.value;
    const accent = form.querySelector('[data-preview-accent]')?.value || '#d71920';
    const card = form.querySelector('[data-preview-card]')?.value || '#ffffff';
    const footer = form.querySelector('[data-preview-footer]')?.value || '#0b2f47';
    const muted = form.querySelector('[data-preview-muted]')?.value || '#6b7280';
    const border = '#d7dde5';

    let css = cssField.value
      .replace(/\/\* np-theme-vars \*\/[\s\S]*?\}\s*/g, '')
      .replace(/\/\* np-portal-config \*\/[\s\S]*?(?=\n\n|$)/g, '')
      .trim();

    const vars = `/* np-theme-vars */\n:root { --site-link: ${link}; --site-button: ${button}; --site-accent: ${accent}; --site-card: ${card}; --site-footer-bg: ${footer}; --site-muted: ${muted}; --site-border: ${border}; }`;
    const portalBlock = `/* np-portal-config */\n${JSON.stringify(buildPortalConfig(), null, 2)}`;
    cssField.value = [vars, portalBlock, css].filter(Boolean).join('\n\n');
  });

  syncIdentityPreviews();
  syncThemePreview();
})();
