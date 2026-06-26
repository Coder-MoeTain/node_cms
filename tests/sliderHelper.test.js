const {
  expandSlidersToSlides,
  getSliderImageAt,
  sliderImageSlots
} = require('../utils/sliderHelper');

test('expandSlidersToSlides uses images array when present', () => {
  const slides = expandSlidersToSlides([{
    title: 'Hero',
    images: ['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']
  }]);
  expect(slides).toHaveLength(3);
  expect(slides.map((slide) => slide.image)).toEqual([
    '/uploads/a.jpg',
    '/uploads/b.jpg',
    '/uploads/c.jpg'
  ]);
  expect(slides.every((slide) => slide.title === 'Hero')).toBe(true);
});

test('expandSlidersToSlides falls back to single image field', () => {
  const slides = expandSlidersToSlides([{ title: 'Legacy', image: '/uploads/one.jpg' }]);
  expect(slides).toHaveLength(1);
  expect(slides[0].image).toBe('/uploads/one.jpg');
});

test('sliderImageSlots returns three slots from images json', () => {
  expect(sliderImageSlots({
    image: '/uploads/primary.jpg',
    images: ['/uploads/1.jpg', '/uploads/2.jpg']
  })).toEqual(['/uploads/1.jpg', '/uploads/2.jpg', '']);
  expect(getSliderImageAt({ image: '/uploads/only.jpg' }, 1)).toBe('/uploads/only.jpg');
});
