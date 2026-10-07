import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS } from '../theme/colors';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { parseContentBlocks, ContentBlock } from '../utils/nativeContentParser';
import { NativeMathView } from './NativeMathView';
import { NativeCodeBlock } from './NativeCodeBlock';
import { MermaidBlock } from './MermaidBlock';
import { CalloutCard } from './CalloutCard';
import { TabbedCodeBlock } from './TabbedCodeBlock';
import { ImageGalleryBlock } from './ImageGalleryBlock';
import { YouTubeCard } from './YouTubeCard';
import { DetailsSpoilerBlock } from './DetailsSpoilerBlock';
import { StepperTimelineBlock } from './StepperTimelineBlock';
import { cleanMarkdown } from '../utils/responsive';
import { ContentErrorBoundary } from './ContentErrorBoundary';

export interface NativeContentRendererProps {
  content?: string | null;
  html?: string | null;
  fontSize?: number;
  textColor?: string;
  variant?: 'question' | 'solution';
  markdownStyles?: any;
  /** Override the markdown render rules (defaults to the shared set). */
  rules?: any;
  style?: StyleProp<ViewStyle>;
}

export const NativeContentRenderer: React.FC<NativeContentRendererProps> = React.memo(
  ({
    content,
    fontSize = 16,
    textColor = COLORS.text,
    variant = 'question',
    markdownStyles,
    rules = markdownRules,
    style,
  }) => {
    const blocks = useMemo(() => {
      if (!content || content.trim().length === 0) return [];
      try {
        return parseContentBlocks(content);
      } catch {
        return [{ type: 'markdown', content } as ContentBlock];
      }
    }, [content]);

    if (!blocks || blocks.length === 0) {
      return null;
    }

    const mdStyles =
      markdownStyles || (variant === 'solution' ? solutionMarkdownStyles : questionMarkdownStyles);

    return (
      <View style={[styles.container, style]}>
        {blocks.map((block: ContentBlock, index: number) => {
          if (block.type === 'mermaid') {
            return (
              <ContentErrorBoundary key={`mermaid-${index}`} fallbackText={block.code}>
                <MermaidBlock code={block.code} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'code') {
            return (
              <ContentErrorBoundary key={`code-${index}`} fallbackText={block.code}>
                <NativeCodeBlock code={block.code} language={block.language} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'code_tabs') {
            return (
              <ContentErrorBoundary key={`code-tabs-${index}`}>
                <TabbedCodeBlock tabs={block.tabs} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'display_math') {
            return (
              <ContentErrorBoundary key={`math-${index}`} fallbackText={block.math}>
                <NativeMathView
                  math={block.math}
                  displayMode={true}
                  fontSize={fontSize}
                  color={textColor}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'callout') {
            return (
              <ContentErrorBoundary key={`callout-${index}`} fallbackText={block.content}>
                <CalloutCard
                  type={block.calloutType}
                  title={block.title}
                  content={block.content}
                  rules={rules}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'image_gallery') {
            return (
              <ContentErrorBoundary key={`gallery-${index}`}>
                <ImageGalleryBlock images={block.images} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'youtube') {
            return (
              <ContentErrorBoundary key={`yt-${index}`}>
                <YouTubeCard
                  videoId={block.videoId}
                  title={block.title}
                  url={block.url}
                  startTime={block.startTime}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'details') {
            return (
              <ContentErrorBoundary key={`details-${index}`}>
                <DetailsSpoilerBlock
                  summary={block.summary}
                  content={block.content}
                  defaultOpen={block.defaultOpen}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'stepper') {
            return (
              <ContentErrorBoundary key={`stepper-${index}`}>
                <StepperTimelineBlock steps={block.steps} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'markdown') {
            return (
              <View key={`md-${index}`} style={styles.markdownBlock}>
                <ContentErrorBoundary fallbackText={block.content}>
                  <Markdown style={mdStyles} rules={rules}>
                    {cleanMarkdown(block.content)}
                  </Markdown>
                </ContentErrorBoundary>
              </View>
            );
          }

          return null;
        })}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  markdownBlock: {
    width: '100%',
  },
});
