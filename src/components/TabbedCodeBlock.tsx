import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { CodeTabItem } from '../utils/codeTabParser';
import { NativeCodeBlock } from './NativeCodeBlock';
import { COLORS, FONTS } from '../theme/colors';

export interface TabbedCodeBlockProps {
  tabs: CodeTabItem[];
}

export const TabbedCodeBlock: React.FC<TabbedCodeBlockProps> = React.memo(({ tabs }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!tabs || tabs.length === 0) return null;

  const currentTab = tabs[activeIndex] || tabs[0];

  const handleSelectTab = (index: number) => {
    if (index === activeIndex) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setActiveIndex(index);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!currentTab?.code) return;
    await Clipboard.setStringAsync(currentTab.code);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsList}
        >
          {tabs.map((tab, idx) => {
            const isActive = idx === activeIndex;
            return (
              <TouchableOpacity
                key={`${tab.label}-${idx}`}
                onPress={() => handleSelectTab(idx)}
                activeOpacity={0.75}
                style={[styles.tabButton, isActive && styles.activeTabButton]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    isActive ? styles.activeTabLabel : styles.inactiveTabLabel,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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

      <NativeCodeBlock
        code={currentTab.code}
        language={currentTab.language}
        hideHeader
        containerStyle={styles.codeContainer}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eaeef2',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 5,
    paddingLeft: 4,
    paddingRight: 10,
  },
  tabsList: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 4,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  activeTabButton: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: FONTS.mono,
    letterSpacing: 0.3,
  },
  activeTabLabel: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  inactiveTabLabel: {
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    paddingVertical: 4,
  },
  copyText: {
    fontSize: 11,
    fontFamily: FONTS.sans,
    color: COLORS.textMuted,
  },
  codeContainer: {
    marginVertical: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
});
