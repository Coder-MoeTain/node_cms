(function initSliderCrop() {
  const modalEl = document.getElementById('sliderImageCropModal');
  const cropImageEl = document.getElementById('sliderCropImage');
  if (!modalEl || !cropImageEl || typeof Cropper === 'undefined') return;

  const MAX_WIDTH = 1920;
  const DEFAULT_ASPECT = 16 / 9;
  let cropper = null;
  let targetContainer = null;
  let pendingFileName = 'slider-photo.jpg';
  let objectUrl = null;

  function parseAspect(value) {
    if (!value) return DEFAULT_ASPECT;
    if (value.includes('/')) {
      const [w, h] = value.split('/').map(Number);
      if (w > 0 && h > 0) return w / h;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_ASPECT;
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  function destroyCropper() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
    revokeObjectUrl();
    cropImageEl.removeAttribute('src');
    cropImageEl.src = '';
  }

  function updatePreview(container, previewUrl) {
    const pathInput = container.querySelector('[data-image-path]');
    const preview = container.querySelector('[data-image-preview]');
    const removeFlag = container.querySelector('[data-image-remove-flag]');
    if (removeFlag) removeFlag.value = '0';
    if (pathInput) pathInput.value = '';

    if (!preview) return;
    if (preview.tagName.toLowerCase() === 'img') {
      preview.src = previewUrl;
      return;
    }

    const image = document.createElement('img');
    image.className = 'settings-image-preview';
    image.dataset.imagePreview = 'true';
    if (pathInput?.name) image.dataset.mediaPreview = pathInput.name;
    image.src = previewUrl;
    image.alt = 'Cropped slider preview';
    preview.replaceWith(image);
    ensureCropButton(container);
  }

  function setFileOnInput(container, file) {
    const fileInput = container.querySelector('[data-image-file]');
    if (!fileInput) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
  }

  function ensureCropButton(container) {
    if (!container.dataset.imageCrop) return;
    if (container.querySelector('[data-crop-existing-image]')) return;

    const actions = container.querySelector('.image-upload-actions');
    if (!actions) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'np-btn np-btn-secondary np-btn-small';
    button.dataset.cropExistingImage = 'true';
    button.textContent = 'Crop';
    actions.appendChild(button);
  }

  function bindCropButtons(container) {
    container.querySelector('[data-crop-existing-image]')?.addEventListener('click', () => {
      const preview = container.querySelector('[data-image-preview]');
      const pathInput = container.querySelector('[data-image-path]');
      const src = preview?.tagName?.toLowerCase() === 'img'
        ? preview.src
        : (pathInput?.value || '');
      if (!src) return;
      const name = src.split('/').pop() || 'slider-photo.jpg';
      openFromUrl({ url: src, container, fileName: name });
    });
  }

  function startCropper(src, container, fileName) {
    targetContainer = container;
    pendingFileName = fileName || 'slider-photo.jpg';
    destroyCropper();
    objectUrl = src.startsWith('blob:') ? src : null;
    cropImageEl.src = src;

    const aspect = parseAspect(container.dataset.imageCrop);
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();

    cropImageEl.onload = () => {
      if (cropper) cropper.destroy();
      cropper = new Cropper(cropImageEl, {
        aspectRatio: aspect,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        responsive: true,
        background: false,
        guides: true,
        center: true,
        highlight: true,
        movable: true,
        zoomable: true,
        scalable: false,
        rotatable: false
      });
    };
  }

  function openFromFile({ file, container }) {
    if (!file || !container) return;
    const url = URL.createObjectURL(file);
    objectUrl = url;
    startCropper(url, container, file.name);
  }

  function openFromUrl({ url, container, fileName }) {
    if (!url || !container) return;
    startCropper(url, container, fileName);
  }

  async function applyCrop() {
    if (!cropper || !targetContainer) return;

    const canvas = cropper.getCroppedCanvas({
      maxWidth: MAX_WIDTH,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    });
    if (!canvas) return;

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
    if (!blob) return;

    const baseName = pendingFileName.replace(/\.[^.]+$/, '') || 'slider-photo';
    const file = new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(blob);

    setFileOnInput(targetContainer, file);
    updatePreview(targetContainer, previewUrl);

    bootstrap.Modal.getInstance(modalEl)?.hide();
  }

  modalEl.querySelector('[data-crop-apply]')?.addEventListener('click', applyCrop);
  modalEl.addEventListener('shown.bs.modal', () => {
    modalEl.style.zIndex = '200060';
    const backdrops = document.querySelectorAll('.modal-backdrop');
    const backdrop = backdrops[backdrops.length - 1];
    if (backdrop) backdrop.style.zIndex = '200055';
  });
  modalEl.addEventListener('hidden.bs.modal', () => {
    destroyCropper();
    targetContainer = null;
  });

  document.querySelectorAll('[data-image-crop]').forEach((container) => {
    ensureCropButton(container);
    bindCropButtons(container);
  });

  window.npSliderCrop = {
    openFromFile,
    openFromUrl,
    isCropField(container) {
      return Boolean(container?.dataset?.imageCrop);
    }
  };
})();
