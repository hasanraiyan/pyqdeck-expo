/**
 * Extracts an 11-character YouTube video ID from various URL patterns:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - @[youtube](https://...)
 */
export const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

/**
 * Regex to match standalone YouTube links, markdown link formats, or embed tags on their own line.
 */
export const STANDALONE_YOUTUBE_REGEX =
  /(?:^|\r?\n)(?:@\[youtube\]\((https?:\/\/[^\s\)\r\n]+)\)|(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^\s\r\n]*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[^\s\r\n]+)|\[([^\]]*)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^\s\r\n]*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[^\s\r\n]+)\))/gi;

export interface YouTubeVideoData {
  videoId: string;
  url: string;
  startTime?: number;
  title?: string;
}

/**
 * Extracts start time in seconds from YouTube query params (e.g. t=385s or t=385 or start=385)
 */
export function extractStartTime(url: string): number | undefined {
  if (!url) return undefined;
  const match = url.match(/[?&](?:t|start)=(\d+)s?/i);
  if (!match || !match[1]) return undefined;
  const secs = parseInt(match[1], 10);
  return isNaN(secs) || secs <= 0 ? undefined : secs;
}

/**
 * Extracts video ID, start time, and clean metadata from a matched string or URL.
 */
export function extractYouTubeData(rawText: string, altTitle?: string): YouTubeVideoData | null {
  if (!rawText) return null;
  const match = rawText.match(YOUTUBE_ID_REGEX);
  if (!match || !match[1]) return null;

  const videoId = match[1];
  const startTime = extractStartTime(rawText);
  return {
    videoId,
    url: startTime
      ? `https://www.youtube.com/watch?v=${videoId}&t=${startTime}s`
      : `https://www.youtube.com/watch?v=${videoId}`,
    startTime,
    title: altTitle?.trim() || undefined,
  };
}

/**
 * Generates reliable YouTube thumbnail URL with fallbacks:
 * maxresdefault -> hqdefault -> mqdefault
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: 'maxres' | 'hq' | 'mq' = 'maxres'
): string {
  switch (quality) {
    case 'maxres':
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    case 'mq':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'hq':
    default:
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
}
