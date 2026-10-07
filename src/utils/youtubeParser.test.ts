import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractYouTubeData,
  getYouTubeThumbnailUrl,
  YOUTUBE_ID_REGEX,
} from './youtubeParser.ts';

test('extracts video ID from standard watch URL', () => {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const data = extractYouTubeData(url);
  assert.ok(data);
  assert.equal(data.videoId, 'dQw4w9WgXcQ');
  assert.equal(data.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('extracts video ID from youtu.be short URL', () => {
  const url = 'https://youtu.be/M7lc1UVf-VE?si=12345';
  const data = extractYouTubeData(url, 'Lecture 1');
  assert.ok(data);
  assert.equal(data.videoId, 'M7lc1UVf-VE');
  assert.equal(data.title, 'Lecture 1');
});

test('extracts video ID from embed and shorts URL', () => {
  const embed = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  const shorts = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';

  const dataEmbed = extractYouTubeData(embed);
  const dataShorts = extractYouTubeData(shorts);

  assert.equal(dataEmbed?.videoId, 'dQw4w9WgXcQ');
  assert.equal(dataShorts?.videoId, 'dQw4w9WgXcQ');
});

test('returns null for non-YouTube URLs', () => {
  assert.equal(extractYouTubeData('https://example.com/video.mp4'), null);
  assert.equal(extractYouTubeData(''), null);
});

test('generates correct thumbnail URLs', () => {
  const hq = getYouTubeThumbnailUrl('dQw4w9WgXcQ', 'hq');
  const max = getYouTubeThumbnailUrl('dQw4w9WgXcQ', 'maxres');
  assert.equal(hq, 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(max, 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
});
