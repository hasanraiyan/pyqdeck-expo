import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { CalloutType, CALLOUT_TYPE_CONFIG } from '../utils/calloutParser';
import { COLORS, FONTS } from '../theme/colors';
import { markdownRules } from '../theme/markdownStyles';
import { cleanMarkdown } from '../utils/responsive';

export interface CalloutCardProps {
  type: CalloutType;
  title?: string;
  content: string;
  rules?: any;
}

export const CalloutCard: React.FC<CalloutCardProps> = React.memo(
  ({ type, title, content, rules = markdownRules }) => {
    const config = CALLOUT_TYPE_CONFIG[type] || CALLOUT_TYPE_CONFIG.note;
    const displayTitle = title || config.label;

    const calloutMdStyles = useMemo(
      () => ({
        body: {
          color: COLORS.text,
          fontSize: 14.5,
          lineHeight: 21,
        },
        paragraph: {
          marginTop: 0,
          marginBottom: 6,
        },
        strong: {
          fontWeight: '700' as const,
          color: COLORS.text,
        },
        em: {
          fontStyle: 'italic' as const,
        },
        code_inline: {
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          color: config.textColor,
          fontFamily: FONTS.bodyMedium,
          fontSize: 12.5,
          paddingHorizontal: 5,
          paddingVertical: 1.5,
          borderRadius: 4,
          borderWidth: 0.5,
          borderColor: 'rgba(0, 0, 0, 0.08)',
        },
        bullet_list: {
          marginVertical: 4,
        },
        ordered_list: {
          marginVertical: 4,
        },
        list_item: {
          marginVertical: 2,
        },
      }),
      [config.textColor]
    );

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: config.bgColor,
            borderLeftColor: config.borderColor,
            borderColor: config.borderColor + '33',
          },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: config.badgeBg }]}>
            <Feather name={config.icon} size={14} color={config.iconColor} />
          </View>
          <Text style={[styles.title, { color: config.textColor }]}>{displayTitle}</Text>
        </View>

        {Boolean(content) && (
          <View style={styles.body}>
            <Markdown style={calloutMdStyles} rules={rules}>
              {cleanMarkdown(content)}
            </Markdown>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13.5,
    letterSpacing: 0.3,
  },
  body: {
    marginTop: 2,
  },
});
