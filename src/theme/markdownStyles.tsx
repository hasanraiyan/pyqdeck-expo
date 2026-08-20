import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import FitImage from 'react-native-fit-image';
import { COLORS, FONTS } from './colors';
import { rf } from '../utils/responsive';
import { HighlightedCode } from '../utils/syntaxHighlighter';

export const baseMarkdownStyles = {
  body: {
    color: COLORS.text,
    fontSize: rf(14),
    lineHeight: rf(22),
    fontFamily: FONTS.serif,
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
    fontSize: rf(18),
    fontWeight: '700' as const,
    color: COLORS.text,
    fontFamily: FONTS.serif,
    marginTop: 14,
    marginBottom: 6,
  },
  heading2: {
    fontSize: rf(16),
    fontWeight: '700' as const,
    color: COLORS.text,
    fontFamily: FONTS.serif,
    marginTop: 12,
    marginBottom: 6,
  },
  heading3: {
    fontSize: rf(14.5),
    fontWeight: '600' as const,
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 4,
  },
  heading4: {
    fontSize: rf(13.5),
    fontWeight: '600' as const,
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  heading5: {
    fontSize: rf(12.5),
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 2,
  },
  heading6: {
    fontSize: rf(12),
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginTop: 6,
    marginBottom: 2,
  },
  strong: {
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  code_inline: {
    backgroundColor: COLORS.cardSecondary,
    color: COLORS.primary,
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

      {isProgLang ? (
        <View style={{ padding: 12 }}>
          <HighlightedCode
            code={content}
            language={lang}
            style={{
              fontFamily: FONTS.mono,
              fontSize: rf(12),
              lineHeight: rf(18),
              color: COLORS.text,
            }}
          />
        </View>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={{ padding: 12, minWidth: '100%' }}
        >
          <HighlightedCode
            code={content}
            language={lang}
            style={{
              fontFamily: FONTS.mono,
              fontSize: rf(12),
              lineHeight: rf(18),
              color: COLORS.text,
            }}
          />
        </ScrollView>
      )}
    </View>
  );
};

export const markdownRules = {
  code_inline: (node: any, children: any, parent: any, styles: any, inheritedStyles: any = {}) => {
    const raw = typeof node.content === 'string' ? node.content : '';

    // Check if it's display math: `$$ ... $$`
    if (raw.startsWith('$$ ') && raw.endsWith(' $$')) {
      const mathExpr = raw.slice(3, -3).trim();
      return (
        <View
          key={node.key}
          style={{
            backgroundColor: COLORS.primaryLight,
            borderWidth: 1,
            borderColor: COLORS.primaryBorder,
            borderRadius: 6,
            paddingVertical: 10,
            paddingHorizontal: 14,
            marginVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
            <Text
              style={{
                fontFamily: FONTS.serif,
                fontStyle: 'italic',
                fontSize: rf(15),
                color: COLORS.primary,
                fontWeight: '600',
                letterSpacing: 0.5,
              }}
            >
              {mathExpr}
            </Text>
          </ScrollView>
        </View>
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
              color: COLORS.primary,
              fontFamily: FONTS.serif,
              fontStyle: 'italic',
              fontWeight: '600',
              backgroundColor: COLORS.primaryLight,
              borderWidth: 0.5,
              borderColor: COLORS.primaryBorder,
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

    return <CodeBlockComponent key={node.key} content={content} language={lang} />;
  },

  code_block: (node: any, children: any, parent: any, styles: any, inheritedStyles: any = {}) => {
    let content = node.content;
    if (typeof content === 'string' && content.charAt(content.length - 1) === '\n') {
      content = content.substring(0, content.length - 1);
    }

    return <CodeBlockComponent key={node.key} content={content} />;
  },

  // Responsive, polished Table with horizontal scroll and clean borders
  table: (node: any, children: any, parent: any, styles: any) => (
    <View
      key={node.key}
      style={{
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginVertical: 12,
        backgroundColor: COLORS.card,
        overflow: 'hidden',
      }}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <View style={{ flexDirection: 'column' }}>
          {children}
        </View>
      </ScrollView>
    </View>
  ),

  thead: (node: any, children: any, parent: any, styles: any) => (
    <View
      key={node.key}
      style={{
        backgroundColor: COLORS.cardSecondary,
        borderBottomWidth: 1.5,
        borderBottomColor: COLORS.border,
      }}
    >
      {children}
    </View>
  ),

  tbody: (node: any, children: any, parent: any, styles: any) => (
    <View key={node.key}>
      {children}
    </View>
  ),

  tr: (node: any, children: any, parent: any, styles: any) => (
    <View
      key={node.key}
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
        alignItems: 'center',
      }}
    >
      {children}
    </View>
  ),

  th: (node: any, children: any, parent: any, styles: any) => (
    <View
      key={node.key}
      style={{
        minWidth: 110,
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        justifyContent: 'center',
      }}
    >
      {typeof children === 'string' ? (
        <Text
          style={{
            fontFamily: FONTS.mono,
            fontSize: rf(11.5),
            fontWeight: '700',
            color: COLORS.text,
            letterSpacing: 0.5,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  ),

  td: (node: any, children: any, parent: any, styles: any) => (
    <View
      key={node.key}
      style={{
        minWidth: 110,
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRightWidth: 1,
        borderRightColor: COLORS.borderLight,
        justifyContent: 'center',
      }}
    >
      {typeof children === 'string' ? (
        <Text style={{ fontSize: rf(12.5), lineHeight: rf(18), color: COLORS.text }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
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
