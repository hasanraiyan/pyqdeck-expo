import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
// @ts-ignore
import CodeHighlighter from 'react-native-code-highlighter';
// @ts-ignore
import { github } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

interface NativeCodeBlockProps {
  code: string;
  language?: string;
}

interface Token {
  text: string;
  type: 'bracket' | 'box' | 'rowcol' | 'arrow' | 'operator' | 'number' | 'keyword' | 'plain';
}

const TOKEN_REGEX =
  /(<-->|<->|-->|==>|->|=>|~)|([RCrc]\d+)|(\b(?:det|rank|dim|nullity|trace|adj|cofactor|mod|div|sin|cos|tan|log|ln|lim)\b)|(\d+(?:\.\d+)?)|([\[\](){}|])|([+─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬])|([=+\-*\/%<>])/g;

function tokenizeAsciiLine(line: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: line.slice(lastIndex, match.index),
        type: 'plain',
      });
    }

    const [full, arrow, rowCol, keyword, number, bracket, box, operator] = match;
    let type: Token['type'] = 'plain';
    if (arrow) type = 'arrow';
    else if (rowCol) type = 'rowcol';
    else if (keyword) type = 'keyword';
    else if (number) type = 'number';
    else if (bracket) type = 'bracket';
    else if (box) type = 'box';
    else if (operator) type = 'operator';

    tokens.push({ text: full, type });
    lastIndex = match.index + full.length;
  }

  if (lastIndex < line.length) {
    tokens.push({
      text: line.slice(lastIndex),
      type: 'plain',
    });
  }

  return tokens;
}

const ASCII_LANGS = new Set([
  'text',
  'txt',
  'ascii',
  'code',
  'plain',
  'none',
  'math',
  'matrix',
  '',
]);

export const NativeCodeBlock: React.FC<NativeCodeBlockProps> = React.memo(
  ({ code, language = 'text' }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      await Clipboard.setStringAsync(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const cleanLang = language ? language.trim().toLowerCase() : 'code';
    const isAscii = ASCII_LANGS.has(cleanLang);

    const lines = useMemo(() => {
      if (!isAscii) return [];
      return code.trimEnd().split('\n');
    }, [code, isAscii]);

    // Detect if content contains matrix or row operations
    const isMatrixContent = useMemo(() => {
      return (
        /\[[\s\d\-+]+\]/.test(code) ||
        /[RCrc]\d+\s*->/.test(code) ||
        /[\[\]|]/.test(code)
      );
    }, [code]);

    const displayLabel = useMemo(() => {
      if (cleanLang === 'ascii' || cleanLang === 'matrix') return cleanLang.toUpperCase();
      if (isAscii && isMatrixContent) return 'MATRIX / ASCII';
      if (isAscii) return cleanLang === 'code' ? 'TEXT' : cleanLang.toUpperCase();
      return cleanLang.toUpperCase();
    }, [cleanLang, isAscii, isMatrixContent]);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.langText}>{displayLabel}</Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={handleCopy}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Feather
              name={copied ? 'check' : 'copy'}
              size={12}
              color={copied ? COLORS.secondary : COLORS.textMuted}
            />
            <Text
              style={[
                styles.copyText,
                copied && { color: COLORS.secondary, fontWeight: '600' },
              ]}
            >
              {copied ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>

        {isAscii ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.asciiContainer}>
              {lines.map((line, lineIdx) => {
                const tokens = tokenizeAsciiLine(line);
                return (
                  <Text key={lineIdx} style={styles.asciiLine}>
                    {tokens.map((token, tokenIdx) => (
                      <Text
                        key={tokenIdx}
                        style={tokenStyles[token.type]}
                      >
                        {token.text}
                      </Text>
                    ))}
                    {tokens.length === 0 ? ' ' : ''}
                  </Text>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <CodeHighlighter
            hljsStyle={github}
            language={cleanLang === 'code' ? 'text' : cleanLang}
            textStyle={styles.codeText}
            scrollViewProps={{
              horizontal: true,
              showsHorizontalScrollIndicator: false,
              contentContainerStyle: styles.scrollContent,
            }}
          >
            {code.trimEnd()}
          </CodeHighlighter>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eaeef2',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  langText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 11,
    fontFamily: FONTS.sans,
    color: COLORS.textMuted,
  },
  scrollContent: {
    padding: 12,
  },
  codeText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  asciiContainer: {
    flexDirection: 'column',
  },
  asciiLine: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
});

const tokenStyles: Record<Token['type'], any> = {
  bracket: {
    color: '#0f766e',
    fontWeight: '700',
  },
  box: {
    color: '#64748b',
    fontWeight: '600',
  },
  rowcol: {
    color: '#7c3aed',
    fontWeight: '700',
  },
  arrow: {
    color: '#d97706',
    fontWeight: '700',
  },
  operator: {
    color: '#e11d48',
    fontWeight: '600',
  },
  number: {
    color: '#0284c7',
    fontWeight: '600',
  },
  keyword: {
    color: '#4f46e5',
    fontWeight: '700',
  },
  plain: {
    color: '#334155',
  },
};
