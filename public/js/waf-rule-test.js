(function () {
  function readJsonField(id, fallback) {
    const field = document.getElementById(id);
    if (!field || !field.value.trim()) return fallback;
    try {
      return JSON.parse(field.value);
    } catch (error) {
      throw new Error(`Invalid JSON in ${id}`);
    }
  }

  function appendRuleFields(payload) {
    const ruleForm = document.getElementById('wafRuleForm');
    if (!ruleForm) return;
    ruleForm.querySelectorAll('input, select, textarea').forEach((field) => {
      if (!field.name || field.type === 'submit' || field.type === 'button') return;
      if (field.type === 'checkbox') {
        if (field.checked) payload.set(field.name, field.value || 'on');
        return;
      }
      payload.set(field.name, field.value);
    });
  }

  function setResult(html, type) {
    const panel = document.getElementById('wafRuleTestResult');
    if (!panel) return;
    panel.className = `np-alert np-alert-${type || 'info'} mb-0`;
    panel.innerHTML = html;
    panel.hidden = false;
  }

  async function runRuleTest(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const csrf = form.querySelector('input[name="_csrf"]');
    if (!csrf) return;

    const payload = new FormData();
    appendRuleFields(payload);
    payload.set('url', form.querySelector('[name="test_url"]')?.value || '/?q=test');
    payload.set('user_agent', form.querySelector('[name="test_user_agent"]')?.value || navigator.userAgent);
    payload.set('ip', form.querySelector('[name="test_ip"]')?.value || '203.0.113.10');
    payload.set('method', form.querySelector('[name="test_method"]')?.value || 'GET');

    try {
      payload.set('query', JSON.stringify(readJsonField('wafTestQuery', { q: '1 OR 1=1' })));
      payload.set('body', JSON.stringify(readJsonField('wafTestBody', {})));
    } catch (error) {
      setResult(error.message, 'danger');
      return;
    }

    button.disabled = true;
    setResult('Running rule test…', 'info');

    try {
      const response = await fetch('/admin/waf/rules/test', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrf.value,
          Accept: 'application/json'
        },
        body: payload
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setResult(data.error || 'Rule test failed.', 'danger');
        return;
      }

      if (data.matched) {
        setResult(
          `<strong>Match detected.</strong> Target <code>${data.match.target}</code> `
          + `(${data.match.key || 'n/a'}) · Risk score <strong>${data.risk_score}</strong>.`,
          'warning'
        );
      } else {
        setResult('<strong>No match.</strong> This sample request would pass the current pattern.', 'success');
      }
    } catch (error) {
      setResult('Could not run rule test. Check your connection and try again.', 'danger');
    } finally {
      button.disabled = false;
    }
  }

  document.querySelectorAll('[data-waf-rule-test]').forEach((form) => {
    form.addEventListener('submit', runRuleTest);
  });
})();
