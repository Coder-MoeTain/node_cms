const { loadPluginSettings, settingBool, settingValue } = require('../../utils/pluginSettings');
const { CONSENT_STORAGE_KEY } = require('../../utils/consentScript');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  async register({ hooks, manifest }) {
    const settings = await loadPluginSettings(manifest.slug, manifest);
    const enabled = settingBool(settings.enabled, true);
    const message = settingValue(settings, 'message', 'We use cookies to improve your experience on this site.');
    const buttonText = settingValue(settings, 'button_text', 'Accept');
    const policyUrl = settingValue(settings, 'policy_url', '/page/privacy');
    const policyLinkText = settingValue(settings, 'policy_link_text', 'Learn more');
    const position = settingValue(settings, 'position', 'bottom');
    const consentDays = Number(settingValue(settings, 'consent_days', '365'));
    const storageKey = CONSENT_STORAGE_KEY;

    hooks.register('publicFooter', () => {
      if (!enabled) return null;
      const positionStyle = position === 'top'
        ? 'top:0;bottom:auto;box-shadow:0 4px 20px rgba(0,0,0,.15)'
        : 'bottom:0;top:auto;box-shadow:0 -4px 20px rgba(0,0,0,.15)';
      return `<div id="np-cookie-notice" class="np-cookie-notice" role="dialog" aria-live="polite" aria-label="Cookie consent" hidden style="${positionStyle}"><div class="np-cookie-inner"><p>${escapeHtml(message)} <a href="${escapeHtml(policyUrl)}">${escapeHtml(policyLinkText)}</a></p><button type="button" class="np-cookie-accept" data-np-cookie-accept>${escapeHtml(buttonText)}</button></div></div><style>.np-cookie-notice{position:fixed;left:0;right:0;z-index:9999;background:#1a1a2e;color:#fff;padding:1rem}.np-cookie-notice[hidden]{display:none}.np-cookie-inner{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}.np-cookie-inner a{color:#9ecbff}.np-cookie-accept{background:#0d6efd;color:#fff;border:0;border-radius:.375rem;padding:.5rem 1.25rem;cursor:pointer}</style><script>(function(){var k='${storageKey}',days=${consentDays},b=document.getElementById('np-cookie-notice');if(!b)return;var saved=localStorage.getItem(k);if(saved){var ts=Number(saved);if(!Number.isNaN(ts)&&(!days||Date.now()-ts<days*86400000))return;localStorage.removeItem(k);}b.hidden=false;b.querySelector('[data-np-cookie-accept]').addEventListener('click',function(){localStorage.setItem(k,String(Date.now()));window.dispatchEvent(new Event('np:consent'));b.hidden=true;});})();</script>`;
    }, 50);

    hooks.register('dashboardWidgets', () => ({
      title: 'Cookie Consent',
      body: enabled
        ? `Consent banner active (${position} position, remembered for <strong>${consentDays}</strong> days).`
        : 'Cookie consent banner is disabled.'
    }));
  }
};
