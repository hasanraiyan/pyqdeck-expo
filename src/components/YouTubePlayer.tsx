import React from 'react';
import YoutubePlayer from 'react-native-youtube-iframe';

export interface YouTubePlayerProps {
  videoId: string;
  startTime?: number;
  autoPlay?: boolean;
  width?: number;
  height: number;
  title?: string;
  onError: (err: string) => void;
}

// Android / iOS: react-native-youtube-iframe (WebView based).
// Web uses YouTubePlayer.web.tsx, because that library cannot be bundled for
// web (it requires the uninstalled react-native-web-webview).
export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  startTime,
  autoPlay,
  width,
  height,
  onError,
}) => (
  <YoutubePlayer
    height={height}
    width={width}
    play={autoPlay}
    videoId={videoId}
    initialPlayerParams={{
      start: startTime,
      rel: false,
      preventFullScreen: false,
    }}
    onError={onError}
    webViewProps={{
      androidLayerType: 'hardware',
      allowsInlineMediaPlayback: true,
    }}
  />
);
