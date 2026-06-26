(function () {
  const btn = document.querySelector('[data-health-refresh]');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const icon = btn.querySelector('.bi');
    if (icon) icon.classList.add('spin');
    try {
      const res = await fetch('/admin/tools/health.json', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Refresh failed');
      window.location.reload();
    } catch {
      btn.disabled = false;
      if (icon) icon.classList.remove('spin');
      window.alert('Could not refresh health checks. Please reload the page.');
    }
  });
})();
