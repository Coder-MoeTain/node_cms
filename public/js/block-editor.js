/* NodePress block editor — lightweight Gutenberg-style foundation */
(function () {
  const BLOCK_TYPES = [
    { type: 'paragraph', label: 'Paragraph', icon: '¶' },
    { type: 'heading', label: 'Heading', icon: 'H' },
    { type: 'image', label: 'Image', icon: '🖼' },
    { type: 'quote', label: 'Quote', icon: '❝' },
    { type: 'button', label: 'Button', icon: '▣' },
    { type: 'list', label: 'List', icon: '≡' },
    { type: 'html', label: 'HTML', icon: '<>' },
    { type: 'spacer', label: 'Spacer', icon: '↕' }
  ];

  function defaultBlock(type) {
    switch (type) {
      case 'heading': return { type, content: 'Heading', attrs: { level: 2 } };
      case 'image': return { type, content: '', attrs: { src: '', alt: '' } };
      case 'button': return { type, content: '', attrs: { url: '#', label: 'Click me' } };
      case 'list': return { type, content: '', items: ['Item one', 'Item two'], attrs: { ordered: false } };
      case 'spacer': return { type, content: '', attrs: { height: 32 } };
      default: return { type, content: '' };
    }
  }

  function escapeHtml(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderBlockEditor(container, initialBlocks) {
    let blocks = Array.isArray(initialBlocks) ? initialBlocks : [];
    const hiddenInput = document.querySelector('[data-block-json-input]');
    const previewEl = document.querySelector('[data-block-preview]');

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
      render();
    }

    function render() {
      container.innerHTML = '';
      const toolbar = document.createElement('div');
      toolbar.className = 'np-block-toolbar mb-3';
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
        } else {
          card.innerHTML += `<textarea class="form-control" data-field="content" rows="3">${escapeHtml(block.content || '')}</textarea>`;
        }

        card.querySelector('[data-del]')?.addEventListener('click', () => { blocks.splice(index, 1); sync(); });
        card.querySelector('[data-dup]')?.addEventListener('click', () => { blocks.splice(index + 1, 0, JSON.parse(JSON.stringify(block))); sync(); });
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
            else {
              block.attrs = block.attrs || {};
              block.attrs[field] = field === 'level' ? Number(el.value) : el.value;
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
    renderBlockEditor(el, initial);
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
