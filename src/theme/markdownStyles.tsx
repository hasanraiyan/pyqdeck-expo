import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import FitImage from 'react-native-fit-image';
import { MarkdownIt } from 'react-native-markdown-display';
import { COLORS, FONTS } from './colors';
import { rf } from '../utils/responsive';
import { HighlightedCode } from '../utils/syntaxHighlighter';
import { MarkdownTable, TableRow, TableCell } from '../components/MarkdownTable';
import { MermaidBlock } from '../components/MermaidBlock';
import { SvgDiagramBlock } from '../components/SvgDiagramBlock';
import { parseSvgContent } from '../utils/svgParser';

// The library's default parser has `typographer` on, which rewrites "(c)" to a
// circled c and also "(r)", "(tm)", "--" and straight quotes. Notes list MCQ
// options as (a) (b) (c), so every other typographic replacement goes too.
export const markdownParser = MarkdownIt({ typographer: false });

export const baseMarkdownStyles = {
  body: {
    color: COLORS.text,
    fontSize: rf(14),
    lineHeight: rf(22),
    fontFamily: FONTS.body,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    color: COLORS.text,
    lineHeight: rf(22),
  },
  hr: {
    backgroundColor: COLORS.border,
    height: 1,
    marginTop: 14,
    marginBottom: 14,
  },
  heading1: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(18),
    color: COLORS.text,
    marginTop: 14,
    marginBottom: 6,
  },
  heading2: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(16),
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(14.5),
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  heading4: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(13.5),
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  heading5: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(12.5),
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 2,
  },
  heading6: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(12),
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 2,
  },
  strong: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.text,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  code_inline: {
    backgroundColor: COLORS.cardSecondary,
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: rf(12.5),
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  code_block: {
    backgroundColor: '#f1f3ee',
    fontFamily: FONTS.mono,
    fontSize: rf(12),
    lineHeight: rf(18),
    color: COLORS.text,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: '#f1f3ee',
    fontFamily: FONTS.mono,
    fontSize: rf(12),
    lineHeight: rf(18),
    color: COLORS.text,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: COLORS.cardSecondary,
    borderLeftColor: COLORS.primary,
    borderLeftWidth: 3.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
    flexDirection: 'row' as const,
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: 'underline' as const,
  },
  // Without an explicit width, react-native-markdown-display's default
  // image style renders at the image's own (often small) intrinsic size.
  // FitImage measures the remote image and picks a matching height once
  // given a width, so '100%' here is what makes a question's diagram/photo
  // fill the available column instead of showing tiny.
  image: {
    width: '100%' as const,
    borderRadius: 6,
    marginVertical: 8,
  },
};

export const questionMarkdownStyles = {
  ...baseMarkdownStyles,
  body: {
    ...baseMarkdownStyles.body,
    fontSize: rf(15),
    lineHeight: rf(24),
  },
};

export const solutionMarkdownStyles = {
  ...baseMarkdownStyles,
  body: {
    ...baseMarkdownStyles.body,
    fontSize: rf(14),
    lineHeight: rf(23),
  },
};

const PROG_LANGUAGES = new Set([
  'python', 'py', 'c', 'cpp', 'c++', 'java', 'js', 'javascript', 'ts', 'typescript',
  'sql', 'html', 'css', 'bash', 'sh', 'json', 'rust', 'go', 'php', 'ruby', 'kotlin', 'swift', 'r', 'dart'
]);

export const CodeBlockComponent: React.FC<{ content: string; language?: string }> = ({
  content,
  language,
}) => {
  const [copied, setCopied] = useState(false);
  const lang = (language || '').trim().toLowerCase();
  const isProgLang = Boolean(lang && PROG_LANGUAGES.has(lang));

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={{
        backgroundColor: '#f6f8fa',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginVertical: 10,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          backgroundColor: COLORS.cardSecondary,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.mono,
            fontSize: rf(10),
            fontWeight: '700',
            color: COLORS.primary,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {lang || 'CODE'}
        </Text>

        <TouchableOpacity
          onPress={handleCopy}
          activeOpacity={0.6}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingVertical: 2,
            paddingHorizontal: 6,
            borderRadius: 3,
            backgroundColor: copied ? COLORS.primaryLight : 'transparent',
          }}
        >
          <Feather
            name={copied ? 'check' : 'copy'}
            size={12}
            color={copied ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={{
              fontFamily: FONTS.mono,
              fontSize: rf(10),
              color: copied ? COLORS.primary : COLORS.textMuted,
              fontWeight: '600',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={{ padding: 12, minWidth: '100%' }}
      >
        <View style={{ alignSelf: 'flex-start' }}>
          <HighlightedCode
            code={content}
            language={lang}
            style={{
              fontFamily: FONTS.mono,
              fontSize: rf(11.5),
              lineHeight: rf(16.5),
              color: COLORS.text,
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export const markdownRules = {
  code_inline: (node: any, children: any, parent: any, styles: any, inheritedStyles: any = {}) => {
    const raw = typeof node.content === 'string' ? node.content : '';

    // Check if it's display math: `$$ ... $$`
    if (raw.startsWith('$$ ') && raw.endsWith(' $$')) {
      const mathExpr = raw.slice(3, -3).trim();
      // code_inline is an INLINE token - markdown-it renders it as a child
      // of the paragraph's Text, so returning a View here (as the block
      // rules like fence/table safely do) nests a View inside a Text, which
      // RN does not support: the outer box gets a visible size from its own
      // fixed padding/border, but the inner Text's layout doesn't measure
      // correctly inside it on Android, so the math text renders invisibly.
      // A single Text with the box styling applied directly avoids that.
      return (
        <Text
          key={node.key}
          style={[
            inheritedStyles,
            {
              fontFamily: FONTS.bodyMedium,
              fontSize: rf(15),
              color: COLORS.text,
              letterSpacing: 0.5,
              backgroundColor: COLORS.cardSecondary,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 6,
              paddingHorizontal: 14,
              paddingVertical: 10,
            },
          ]}
        >
          {mathExpr}
        </Text>
      );
    }

    // Check if it's inline math: `$ ... $`
    if (raw.startsWith('$ ') && raw.endsWith(' $')) {
      const mathExpr = raw.slice(2, -2).trim();
      return (
        <Text
          key={node.key}
          style={[
            inheritedStyles,
            {
              color: COLORS.text,
              fontFamily: FONTS.bodyMedium,
              backgroundColor: COLORS.cardSecondary,
              borderWidth: 0.5,
              borderColor: COLORS.border,
              borderRadius: 3,
              paddingHorizontal: 4,
              paddingVertical: 1,
            },
          ]}
        >
          {mathExpr}
        </Text>
      );
    }

    // Standard inline code
    return (
      <Text key={node.key} style={[inheritedStyles, styles.code_inline]}>
        {raw}
      </Text>
    );
  },

  fence: (node: any, children: any, parent: any, styles: any, inheritedStyles: any = {}) => {
    let content = node.content;
    if (typeof content === 'string' && content.charAt(content.length - 1) === '\n') {
      content = content.substring(0, content.length - 1);
    }
    const lang = (node.sourceInfo || node.info || '').trim();

    if (lang.toLowerCase() === 'mermaid') {
      return <MermaidBlock key={node.key} code={content} />;
    }

    if (lang.toLowerCase() === 'svg') {
      const svgData = parseSvgContent(content);
      if (svgData) {
        return (
          <SvgDiagramBlock
            key={node.key}
            xml={svgData.xml}
            title={svgData.title}
            aspectRatio={svgData.aspectRatio}
          />
        );
      }
    }

    return <CodeBlockComponent key={node.key} content={content} language={lang} />;
  },

  code_block: (node: any, children: any, parent: any, styles: any, inheritedStyles: any = {}) => {
    let content = node.content;
    if (typeof content === 'string' && content.charAt(content.length - 1) === '\n') {
      content = content.substring(0, content.length - 1);
    }

    return <CodeBlockComponent key={node.key} content={content} />;
  },

  // Mobile-first table: shared per-column widths, wrapping text, zebra rows,
  // horizontal scroll only when the table is genuinely wider than the screen.
  table: (node: any, children: any) => (
    <MarkdownTable key={node.key} node={node}>
      {children}
    </MarkdownTable>
  ),

  thead: (node: any, children: any) => <View key={node.key}>{children}</View>,

  tbody: (node: any, children: any) => <View key={node.key}>{children}</View>,

  tr: (node: any, children: any, parent: any) => {
    const inHead = Array.isArray(parent) && parent.some((p: any) => p.type === 'thead');
    const siblings = Array.isArray(parent) ? parent[0]?.children : undefined;
    const last = !!siblings && node.index === siblings.length - 1;
    return (
      <TableRow key={node.key} header={inHead} zebra={!inHead && node.index % 2 === 1} last={last}>
        {children}
      </TableRow>
    );
  },

  th: (node: any, children: any, parent: any) => (
    <TableCell
      key={node.key}
      index={node.index}
      header
      last={Array.isArray(parent) && node.index === (parent[0]?.children?.length ?? 0) - 1}
    >
      {children}
    </TableCell>
  ),

  td: (node: any, children: any, parent: any) => (
    <TableCell
      key={node.key}
      index={node.index}
      last={Array.isArray(parent) && node.index === (parent[0]?.children?.length ?? 0) - 1}
    >
      {children}
    </TableCell>
  ),

  image: (
    node: any,
    children: any,
    parent: any,
    styles: any,
    allowedImageHandlers: any,
    defaultImageHandler: any
  ) => {
    const { src, alt } = node.attributes;

    const show =
      allowedImageHandlers &&
      allowedImageHandlers.filter((value: string) =>
        src.toLowerCase().startsWith(value.toLowerCase())
      ).length > 0;

    if (show === false && defaultImageHandler === null) {
      return null;
    }

    const imageProps: Record<string, any> = {
      indicator: true,
      style: styles._VIEW_SAFE_image,
      source: {
        uri: show === true ? src : `${defaultImageHandler || ''}${src}`,
      },
    };

    if (alt) {
      imageProps.accessible = true;
      imageProps.accessibilityLabel = alt;
    }

    return <FitImage key={node.key} {...imageProps} />;
  },
};
