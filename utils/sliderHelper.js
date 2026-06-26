const { resolveImageValue } = require('./uploadHelper');

const SLIDER_IMAGE_SLOTS = 3;

function getSliderImageAt(record, slotIndex) {
  if (!record) return '';
  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : record;
  let images = plain.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }
  if (Array.isArray(images) && images[slotIndex - 1]) {
    return images[slotIndex - 1];
  }
  if (slotIndex === 1 && plain.image) {
    return plain.image;
  }
  return '';
}

function sliderImageSlots(record) {
  const slots = [];
  for (let i = 1; i <= SLIDER_IMAGE_SLOTS; i += 1) {
    slots.push(getSliderImageAt(record, i));
  }
  return slots;
}

async function resolveSliderImages(req, record, transaction) {
  const images = [];
  for (let i = 1; i <= SLIDER_IMAGE_SLOTS; i += 1) {
    const pathField = i === 1 ? 'image' : `image_${i}`;
    const fileField = i === 1 ? 'image_file' : `image_file_${i}`;
    const path = await resolveImageValue(req, {
      fileField,
      pathField,
      record: record ? { image: getSliderImageAt(record, i) } : null,
      transaction
    });
    if (path) images.push(path);
  }
  return images;
}

function expandSlidersToSlides(sliders = []) {
  const slides = [];
  for (const slider of sliders) {
    const plain = typeof slider.get === 'function' ? slider.get({ plain: true }) : slider;
    let images = plain.images;
    if (typeof images === 'string') {
      try {
        images = JSON.parse(images);
      } catch {
        images = [];
      }
    }
    const imageList = Array.isArray(images) && images.length
      ? images.filter(Boolean)
      : (plain.image ? [plain.image] : []);
    if (!imageList.length) {
      slides.push({ ...plain, image: plain.image || null });
      continue;
    }
    imageList.forEach((image) => {
      slides.push({ ...plain, image });
    });
  }
  return slides;
}

module.exports = {
  SLIDER_IMAGE_SLOTS,
  getSliderImageAt,
  sliderImageSlots,
  resolveSliderImages,
  expandSlidersToSlides
};
