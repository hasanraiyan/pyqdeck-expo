import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPureImageTag,
  parseImageTag,
  groupImageGalleries,
} from './imageGalleryParser.ts';

test('isPureImageTag and parseImageTag parse markdown images properly', () => {
  const single = '![8086 CPU Architecture](https://example.com/cpu.png)';
  assert.equal(isPureImageTag(single), true);

  const parsed = parseImageTag(single);
  assert.ok(parsed);
  assert.equal(parsed?.alt, '8086 CPU Architecture');
  assert.equal(parsed?.src, 'https://example.com/cpu.png');

  assert.equal(isPureImageTag('Some text ![alt](url) more text'), false);
  assert.equal(parseImageTag('Some text'), null);
});

test('groupImageGalleries converts isolated single image to 1-item gallery', () => {
  const blocks = [
    { type: 'markdown', content: 'Intro' },
    { type: 'image', src: 'https://img1.png', alt: 'Img 1' },
    { type: 'markdown', content: 'Outro' },
  ];

  const grouped = groupImageGalleries(blocks);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[1].type, 'image_gallery');
  assert.equal((grouped[1] as any).images.length, 1);
  assert.equal((grouped[1] as any).images[0].src, 'https://img1.png');
});

test('groupImageGalleries merges consecutive multiple images into single gallery block', () => {
  const blocks = [
    { type: 'markdown', content: 'Here are the waveforms:' },
    { type: 'image', src: 'https://img1.png', alt: 'Clock Signal' },
    { type: 'image', src: 'https://img2.png', alt: 'ALE Signal' },
    { type: 'image', src: 'https://img3.png', alt: 'RD Signal' },
    { type: 'image', src: 'https://img4.png', alt: 'WR Signal' },
    { type: 'image', src: 'https://img5.png', alt: 'READY Signal' },
    { type: 'image', src: 'https://img6.png', alt: 'RESET Signal' },
    { type: 'markdown', content: 'End of waveforms.' },
  ];

  const grouped = groupImageGalleries(blocks);
  assert.equal(grouped.length, 3);
  assert.equal(grouped[1].type, 'image_gallery');

  const gallery = grouped[1] as any;
  assert.equal(gallery.images.length, 6);
  assert.equal(gallery.images[0].alt, 'Clock Signal');
  assert.equal(gallery.images[5].alt, 'RESET Signal');
});
