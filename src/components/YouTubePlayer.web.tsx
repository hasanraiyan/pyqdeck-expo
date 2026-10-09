import React, { useMemo } from 'react';
import type { YouTubePlayerProps } from './YouTubePlayer';

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  startTime,
  autoPlay,
  title,
}) => {
  const src = useMemo(() => {
    const params = new URLSearchParams({ rel: '0', playsinline: '1' });
    if (startTime && startTime > 0) params.set('start', String(Math.floor(startTime)));
    if (autoPlay) params.set('autoplay', '1');
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }, [videoId, startTime, autoPlay]);

  // react-native-web has no iframe primitive, so render the DOM element directly.
  return React.createElement('iframe' as any, {
    src,
    title: title || 'YouTube video player',
    style: { width: '100%', height: '100%', border: 0 },
    allow:
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    loading: 'lazy',
  });
};
