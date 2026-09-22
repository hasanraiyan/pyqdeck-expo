import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.langText}>{cleanLang.toUpperCase()}</Text>
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
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    backgroundColor: '#f6f8fa',
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
});
