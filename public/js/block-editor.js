/* NodePress block editor — lightweight Gutenberg-style foundation */
(function () {
  const BLOCK_TYPES = [
    { type: 'paragraph', label: 'Paragraph', icon: '¶' },
    { type: 'heading', label: 'Heading', icon: 'H' },
    { type: 'image', label: 'Image', icon: '🖼' },
    { type: 'quote', label: 'Quote', icon: '❝' },
    { type: 'button', label: 'Button', icon: '▣' },
    { type: 'list', label: 'List', icon: '≡' },
    { type: 'columns', label: 'Columns', icon: '▥' },
    { type: 'gallery', label: 'Gallery', icon: '▦' },
    { type: 'cover', label: 'Cover', icon: '▣' },
    { type: 'embed', label: 'Embed', icon: '▶' },
    { type: 'separator', label: 'Separator', icon: '—' },
    { type: 'code', label: 'Code', icon: '{}' },
    { type: 'video', label: 'Video', icon: '▶' },
    { type: 'audio', label: 'Audio', icon: '♪' },
    { type: 'file', label: 'File', icon: '📎' },
    { type: 'table', label: 'Table', icon: '⊞' },
    { type: 'latest-posts', label: 'Latest posts', icon: '↻' },
    { type: 'contact-form', label: 'Contact form', icon: '✉' },
    { type: 'shortcode', label: 'Shortcode', icon: '[]' },
    { type: 'media-gallery', label: 'Media gallery', icon: '▦' },
    { type: 'html', label: 'HTML', icon: '<>' },
    { type: 'spacer', label: 'Spacer', icon: '↕' }
  ];

  function defaultBlock(type) {
    switch (type) {
      case 'heading': return { type, content: 'Heading', attrs: { level: 2 } };
      case 'image': return { type, content: '', attrs: { src: '', alt: '' } };
      case 'button': return { type, content: '', attrs: { url: '#', label: 'Click me' } };
      case 'list': return { type, content: '', items: ['Item one', 'Item two'], attrs: { ordered: false } };
      case 'columns': return { type, content: '', columns: ['Column one', 'Column two'], attrs: { columns: ['Column one', 'Column two'] } };
      case 'gallery': return { type, content: '', attrs: { images: [] } };
      case 'cover': return { type, content: 'Cover title', attrs: { src: '', title: 'Cover title' } };
      case 'embed': return { type, content: '', attrs: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } };
      case 'separator': return { type, content: '' };
      case 'code': return { type, content: 'console.log("hello");' };
      case 'video': return { type, content: '', attrs: { src: '' } };
      case 'audio': return { type, content: '', attrs: { src: '' } };
      case 'file': return { type, content: '', attrs: { url: '#', label: 'Download' } };
      case 'table': return { type, content: '', rows: [['Header 1', 'Header 2'], ['Cell', 'Cell']] };
      case 'latest-posts': return { type, content: '', attrs: { limit: 5 } };
      case 'contact-form': return { type, content: '', attrs: { redirect: '/contact', label: 'Contact us' } };
      case 'shortcode': return { type, content: '[recent_posts limit="5"]' };
      case 'media-gallery': return { type, content: '', attrs: { images: [] } };
      case 'spacer': return { type, content: '', attrs: { height: 32 } };
      default: return { type, content: '' };
    }
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderBlockEditor(container, initialBlocks) {
    let blocks = Array.isArray(initialBlocks) ? initialBlocks : [];
    const wrap = container.closest('[data-block-editor-wrap]') || container.parentElement;
    const hiddenInput = wrap?.querySelector('[data-block-json-input]') || document.querySelector('[data-block-json-input]');
    const previewEl = wrap?.querySelector('[data-block-preview]') || document.querySelector('[data-block-preview]');

    function sync() {
      if (hiddenInput) hiddenInput.value = JSON.stringify(blocks);
      if (previewEl) {
        previewEl.innerHTML = blocks.map((b) => {
          if (b.type === 'heading') return `<h${b.attrs?.level || 2}>${escapeHtml(b.content)}</h${b.attrs?.level || 2}>`;
          if (b.type === 'image' && b.attrs?.src) return `<img src="${escapeHtml(b.attrs.src)}" alt="${escapeHtml(b.attrs?.alt)}">`;
          if (b.type === 'quote') return `<blockquote>${escapeHtml(b.content)}</blockquote>`;
          if (b.type === 'button') return `<a href="${escapeHtml(b.attrs?.url)}">${escapeHtml(b.attrs?.label || b.content)}</a>`;
          return `<p>${escapeHtml(b.content)}</p>`;
        }).join('');
      }
      const form = container.closest('form');
      if (form) form.dispatchEvent(new Event('input', { bubbles: true }));
      render();
    }

    function render() {
      container.innerHTML = '';
      const toolbar = document.createElement('div');
      toolbar.className = 'np-block-toolbar mb-3';
      const patternBtn = document.createElement('button');
      patternBtn.type = 'button';
      patternBtn.className = 'np-btn np-btn-secondary np-btn-small me-2 mb-1';
      patternBtn.textContent = 'Patterns';
      patternBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/admin/api/block-patterns', { headers: { Accept: 'application/json' } });
          const json = await res.json();
          const slug = window.prompt(`Insert pattern slug:\n${(json.data || []).map((p) => p.slug).join(', ')}`);
          if (!slug) return;
          const detail = await fetch(`/admin/api/block-patterns/${encodeURIComponent(slug)}`, { headers: { Accept: 'application/json' } });
          const pattern = (await detail.json()).data;
          if (pattern?.blocks?.length) {
            blocks.push(...pattern.blocks.map((b) => JSON.parse(JSON.stringify(b))));
            sync();
          }
        } catch (error) {
          window.alert(error.message || 'Could not load pattern.');
        }
      });
      toolbar.appendChild(patternBtn);
      const reusableBtn = document.createElement('button');
      reusableBtn.type = 'button';
      reusableBtn.className = 'np-btn np-btn-secondary np-btn-small me-2 mb-1';
      reusableBtn.textContent = 'Reusable';
      reusableBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/admin/api/reusable-blocks', { headers: { Accept: 'application/json' } });
          const json = await res.json();
          const list = json.data || [];
          if (!list.length) {
            window.alert('No reusable blocks saved yet. Use ★ on a block to save one.');
            return;
          }
          const slug = window.prompt(`Insert reusable block slug:\n${list.map((b) => `${b.slug} — ${b.title}`).join('\n')}`);
          if (!slug) return;
          const detail = await fetch(`/admin/api/reusable-blocks/${encodeURIComponent(slug.trim())}`, { headers: { Accept: 'application/json' } });
          if (!detail.ok) throw new Error('Block not found');
          const reusable = (await detail.json()).data;
          if (reusable?.blocks?.length) {
            blocks.push(...reusable.blocks.map((b) => JSON.parse(JSON.stringify(b))));
            sync();
          }
        } catch (error) {
          window.alert(error.message || 'Could not load reusable block.');
        }
      });
      toolbar.appendChild(reusableBtn);
      BLOCK_TYPES.forEach((bt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'np-btn np-btn-secondary np-btn-small me-1 mb-1';
        btn.textContent = bt.label;
        btn.addEventListener('click', () => { blocks.push(defaultBlock(bt.type)); sync(); });
        toolbar.appendChild(btn);
      });
      container.appendChild(toolbar);

      blocks.forEach((block, index) => {
        const card = document.createElement('div');
        card.className = 'np-block-card mb-2';
        card.innerHTML = `<div class="np-block-card-header"><strong>${block.type}</strong>
          <span class="np-block-actions">
            <button type="button" data-up="${index}">↑</button>
            <button type="button" data-down="${index}">↓</button>
            <button type="button" data-dup="${index}">⧉</button>
            <button type="button" data-save-reusable="${index}">★</button>
            <button type="button" data-del="${index}">✕</button>
          </span></div>`;

        if (block.type === 'heading') {
          card.innerHTML += `<label>Level <input type="number" min="1" max="6" data-field="level" value="${block.attrs?.level || 2}"></label>
            <textarea class="form-control mt-1" data-field="content" rows="2">${escapeHtml(block.content)}</textarea>`;
        } else if (block.type === 'image') {
          const src = block.attrs?.src || '';
          card.innerHTML += `
            <div class="np-block-image-field" data-block-image-field>
              <div class="np-block-image-preview mb-2${src ? '' : ' is-empty'}">
                ${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.attrs?.alt || '')}">` : '<span class="text-muted small">No image selected</span>'}
              </div>
              <input type="file" class="d-none" accept="image/jpeg,image/png,image/gif,image/webp" data-block-image-file>
              <div class="d-flex flex-wrap gap-2 mb-2">
                <button type="button" class="np-btn np-btn-secondary np-btn-small" data-block-image-upload>Upload photo</button>
                <button type="button" class="np-btn np-btn-secondary np-btn-small" data-block-image-library>Media library</button>
                ${src ? '<button type="button" class="np-btn np-btn-link np-btn-small text-danger" data-block-image-remove>Remove</button>' : ''}
              </div>
              <input class="form-control" data-field="alt" placeholder="Alt text" value="${escapeHtml(block.attrs?.alt || '')}">
            </div>`;

          const fileInput = card.querySelector('[data-block-image-file]');

          function setBlockImage(filePath, altText) {
            block.attrs = block.attrs || {};
            block.attrs.src = filePath;
            if (altText && !block.attrs.alt) block.attrs.alt = altText;
            sync();
          }

          card.querySelector('[data-block-image-upload]')?.addEventListener('click', () => fileInput?.click());

          fileInput?.addEventListener('change', async () => {
            const file = fileInput.files?.[0];
            if (!file || typeof window.npUploadImage !== 'function') return;
            try {
              const uploaded = await window.npUploadImage(file);
              setBlockImage(uploaded.filePath, uploaded.originalName || '');
            } catch (error) {
              window.alert(error.message || 'Upload failed.');
            }
            fileInput.value = '';
          });

          card.querySelector('[data-block-image-library]')?.addEventListener('click', () => {
            if (typeof window.npOpenMediaPicker !== 'function') return;
            window.npOpenMediaPicker((item) => {
              setBlockImage(item.filePath, item.originalName || '');
            });
          });

          card.querySelector('[data-block-image-remove]')?.addEventListener('click', () => {
            block.attrs = block.attrs || {};
            block.attrs.src = '';
            sync();
          });
        } else if (block.type === 'button') {
          card.innerHTML += `<input class="form-control mb-1" data-field="url" placeholder="URL" value="${escapeHtml(block.attrs?.url || '')}">
            <input class="form-control" data-field="label" placeholder="Label" value="${escapeHtml(block.attrs?.label || '')}">`;
        } else if (block.type === 'list') {
          card.innerHTML += `<textarea class="form-control" data-field="items" rows="4">${escapeHtml((block.items || []).join('\n'))}</textarea>`;
        } else if (block.type === 'columns') {
          card.innerHTML += `<textarea class="form-control" data-field="columns" rows="4">${escapeHtml((block.columns || block.attrs?.columns || []).join('\n'))}</textarea>`;
        } else if (block.type === 'embed' || block.type === 'video' || block.type === 'audio' || block.type === 'file') {
          card.innerHTML += `<input class="form-control mb-1" data-field="url" placeholder="URL" value="${escapeHtml(block.attrs?.url || block.attrs?.src || '')}">
            ${block.type === 'file' ? `<input class="form-control" data-field="label" placeholder="Label" value="${escapeHtml(block.attrs?.label || '')}">` : ''}`;
        } else if (block.type === 'cover') {
          card.innerHTML += `<input class="form-control mb-1" data-field="src" placeholder="Background image URL" value="${escapeHtml(block.attrs?.src || '')}">
            <input class="form-control" data-field="title" placeholder="Title" value="${escapeHtml(block.attrs?.title || block.content || '')}">`;
        } else if (block.type === 'table') {
          card.innerHTML += `<textarea class="form-control" data-field="rows" rows="5">${escapeHtml((block.rows || []).map((r) => r.join('\t')).join('\n'))}</textarea>`;
        } else if (block.type === 'latest-posts') {
          card.innerHTML += `<label>Limit <input class="form-control" type="number" min="1" max="20" data-field="limit" value="${block.attrs?.limit || 5}"></label>`;
        } else if (block.type === 'contact-form') {
          card.innerHTML += `<input class="form-control mb-1" data-field="redirect" placeholder="Redirect URL" value="${escapeHtml(block.attrs?.redirect || '/contact')}">
            <input class="form-control" data-field="label" placeholder="Button label" value="${escapeHtml(block.attrs?.label || 'Contact us')}">`;
        } else if (block.type === 'shortcode') {
          card.innerHTML += `<textarea class="form-control" data-field="content" rows="3">${escapeHtml(block.content || '')}</textarea>`;
        } else if (block.type === 'separator') {
          card.innerHTML += '<p class="text-muted small mb-0">Horizontal rule</p>';
        } else {
          card.innerHTML += `<textarea class="form-control" data-field="content" rows="3">${escapeHtml(block.content || '')}</textarea>`;
        }

        card.querySelector('[data-del]')?.addEventListener('click', () => { blocks.splice(index, 1); sync(); });
        card.querySelector('[data-dup]')?.addEventListener('click', () => { blocks.splice(index + 1, 0, JSON.parse(JSON.stringify(block))); sync(); });
        card.querySelector('[data-save-reusable]')?.addEventListener('click', async () => {
          const title = window.prompt('Reusable block name');
          if (!title) return;
          try {
            const csrf = document.querySelector('input[name="_csrf"]')?.value || '';
            const res = await fetch('/admin/api/reusable-blocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf },
              body: JSON.stringify({ title, blocks: [JSON.parse(JSON.stringify(block))] })
            });
            if (!res.ok) throw new Error('Save failed');
            window.alert('Saved as reusable block.');
          } catch (error) {
            window.alert(error.message || 'Could not save reusable block.');
          }
        });
        card.querySelector('[data-up]')?.addEventListener('click', () => {
          if (index > 0) { const t = blocks[index - 1]; blocks[index - 1] = blocks[index]; blocks[index] = t; sync(); }
        });
        card.querySelector('[data-down]')?.addEventListener('click', () => {
          if (index < blocks.length - 1) { const t = blocks[index + 1]; blocks[index + 1] = blocks[index]; blocks[index] = t; sync(); }
        });

        card.querySelectorAll('[data-field]').forEach((el) => {
          el.addEventListener('input', () => {
            const field = el.getAttribute('data-field');
            if (field === 'content') block.content = el.value;
            else if (field === 'items') block.items = el.value.split('\n').filter(Boolean);
            else if (field === 'columns') {
              block.columns = el.value.split('\n').filter(Boolean);
              block.attrs = block.attrs || {};
              block.attrs.columns = block.columns;
            } else if (field === 'rows') {
              block.rows = el.value.split('\n').filter(Boolean).map((line) => line.split('\t'));
            } else {
              block.attrs = block.attrs || {};
              if (field === 'url' && (block.type === 'video' || block.type === 'audio')) block.attrs.src = el.value;
              else block.attrs[field] = field === 'level' ? Number(el.value) : el.value;
            }
            sync();
          });
        });

        container.appendChild(card);
      });
    }

    sync();
    return { getBlocks: () => blocks, setBlocks: (b) => { blocks = b; sync(); } };
  }

  document.querySelectorAll('[data-block-editor]').forEach((el) => {
    let initial = [];
    try {
      initial = JSON.parse(el.dataset.initialBlocks || '[]');
    } catch { initial = []; }
    el.__npBlockEditor = renderBlockEditor(el, initial);
  });

  document.querySelectorAll('[data-editor-mode-toggle]').forEach((toggle) => {
    toggle.addEventListener('change', () => {
      const classic = document.querySelector('[data-classic-editor]');
      const blockWrap = document.querySelector('[data-block-editor-wrap]');
      const isBlock = toggle.value === 'block';
      if (classic) classic.classList.toggle('d-none', isBlock);
      if (blockWrap) blockWrap.classList.toggle('d-none', !isBlock);
      const formatInput = document.querySelector('[name="content_format"]');
      if (formatInput) formatInput.value = isBlock ? 'block' : 'classic';
    });
  });
})();
