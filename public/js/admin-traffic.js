(function () {
  const statusEl = document.getElementById('traffic-live-status');
  const pauseBtn = document.getElementById('traffic-pause-btn');
  const liveBody = document.getElementById('traffic-live-body');
  const liveEmpty = document.getElementById('traffic-live-empty');
  const liveCount = document.getElementById('traffic-live-count');
  const hitsTodayEl = document.getElementById('stat-hits-today');
  const hitsHourEl = document.getElementById('stat-hits-hour');
  const activeNowEl = document.getElementById('stat-active-now');

  if (!liveBody || !statusEl) return;

  let paused = false;
  let sessionCount = 0;
  let source = null;
  const maxRows = 80;

  function formatTime(value) {
    if (window.npFormatDateTime) return window.npFormatDateTime(value, { timeStyle: 'medium' });
    try {
      return new Date(value).toLocaleTimeString();
    } catch {
      return value;
    }
  }

  function statusBadgeClass(code) {
    if (code >= 500) return 'danger';
    if (code >= 400) return 'warning';
    return 'success';
  }

  function prependRow(entry) {
    if (liveEmpty) liveEmpty.remove();
    const tr = document.createElement('tr');
    tr.innerHTML = [
      `<td>${formatTime(entry.created_at)}</td>`,
      `<td><code>${entry.ip_address || ''}</code></td>`,
      `<td class="text-truncate" style="max-width:220px" title="${entry.path || ''}">${entry.path || ''}</td>`,
      `<td><span class="np-badge np-badge-${statusBadgeClass(entry.response_status)}">${entry.response_status}</span></td>`,
      `<td>${entry.response_ms != null ? entry.response_ms + ' ms' : '—'}</td>`,
      `<td><span class="np-badge np-badge-muted">${entry.device_type || 'unknown'}</span></td>`,
      `<td>${entry.browser || '—'}</td>`,
      `<td class="text-truncate" style="max-width:180px" title="${entry.referer || ''}">${entry.referer || '—'}</td>`
    ].join('');
    liveBody.prepend(tr);
    while (liveBody.children.length > maxRows) {
      liveBody.lastElementChild?.remove();
    }
  }

  function bumpStats() {
    sessionCount += 1;
    if (liveCount) liveCount.textContent = `${sessionCount} event${sessionCount === 1 ? '' : 's'} this session`;
    if (hitsTodayEl) hitsTodayEl.textContent = String(Number(hitsTodayEl.textContent || 0) + 1);
    if (hitsHourEl) hitsHourEl.textContent = String(Number(hitsHourEl.textContent || 0) + 1);
    if (activeNowEl) activeNowEl.textContent = String(Number(activeNowEl.textContent || 0) + 1);
  }

  function setStatus(text, tone) {
    statusEl.textContent = text;
    statusEl.className = `np-badge np-badge-${tone || 'muted'}`;
  }

  function connect() {
    if (source) {
      source.close();
      source = null;
    }
    setStatus('Connecting…', 'muted');
    source = new EventSource('/admin/traffic/stream');

    source.addEventListener('connected', () => {
      setStatus('Live', 'success');
    });

    source.addEventListener('hit', (event) => {
      if (paused) return;
      try {
        const entry = JSON.parse(event.data);
        prependRow(entry);
        bumpStats();
      } catch {
        /* ignore malformed payloads */
      }
    });

    source.onerror = () => {
      setStatus('Reconnecting…', 'warning');
      source.close();
      source = null;
      window.setTimeout(connect, 3000);
    };
  }

  pauseBtn?.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Resume live' : 'Pause live';
    setStatus(paused ? 'Paused' : 'Live', paused ? 'warning' : 'success');
  });

  connect();
})();
