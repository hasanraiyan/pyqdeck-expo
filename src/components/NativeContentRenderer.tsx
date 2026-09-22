import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS } from '../theme/colors';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { parseContentBlocks, ContentBlock } from '../utils/nativeContentParser';
import { NativeMathView } from './NativeMathView';
import { NativeCodeBlock } from './NativeCodeBlock';
import { cleanMarkdown } from '../utils/responsive';

export interface NativeContentRendererProps {
  content?: string | null;
  html?: string | null;
  fontSize?: number;
  textColor?: string;
  variant?: 'question' | 'solution';
  markdownStyles?: any;
  style?: StyleProp<ViewStyle>;
}

export const NativeContentRenderer: React.FC<NativeContentRendererProps> = React.memo(
  ({
    content,
    fontSize = 16,
    textColor = COLORS.text,
    variant = 'question',
    markdownStyles,
    style,
  }) => {
    const blocks = useMemo(() => {
      if (!content || content.trim().length === 0) return [];
      return parseContentBlocks(content);
    }, [content]);

    if (!blocks || blocks.length === 0) {
      return null;
    }

    const mdStyles =
      markdownStyles || (variant === 'solution' ? solutionMarkdownStyles : questionMarkdownStyles);

    return (
      <View style={[styles.container, style]}>
        {blocks.map((block: ContentBlock, index: number) => {
          if (block.type === 'code') {
            return (
              <NativeCodeBlock
                key={`code-${index}`}
                code={block.code}
                language={block.language}
              />
            );
          }

          if (block.type === 'display_math') {
            return (
              <NativeMathView
                key={`math-${index}`}
                math={block.math}
                displayMode={true}
                fontSize={fontSize}
                color={textColor}
              />
            );
          }

          // Markdown prose
          return (
            <View key={`md-${index}`} style={styles.markdownBlock}>
              <Markdown
                style={mdStyles}
                rules={markdownRules}
              >
                {cleanMarkdown(block.content)}
              </Markdown>
            </View>
          );
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
