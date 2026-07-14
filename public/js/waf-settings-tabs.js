(function initWafSettingsTabs() {
  const tabs = document.querySelectorAll('[data-waf-tab]');
  const panels = document.querySelectorAll('[data-waf-panel]');
  if (!tabs.length) return;

  function activate(name) {
    tabs.forEach((tab) => {
      const active = tab.getAttribute('data-waf-tab') === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const active = panel.getAttribute('data-waf-panel') === name;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    try {
      window.localStorage.setItem('wafSettingsTab', name);
    } catch {
      // ignore storage errors
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.getAttribute('data-waf-tab')));
  });

  let initial = 'general';
  try {
    initial = window.localStorage.getItem('wafSettingsTab') || 'general';
  } catch {
    initial = 'general';
  }
  if (!document.querySelector(`[data-waf-panel="${initial}"]`)) initial = 'general';
  activate(initial);
})();
