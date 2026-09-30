import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { AiOverviewReference } from '../types';
import { rf } from '../utils/responsive';

interface Props {
  /** The sources to list; null keeps the sheet closed. */
  refs: AiOverviewReference[] | null;
  onClose: () => void;
  onPressReference: (ref: AiOverviewReference) => void;
}

/**
 * Slide-up list of the pages behind an AI answer. Shared by the overview card
 * and the chat, so a citation looks and opens the same everywhere. Each row
 * jumps to its question, paper or study note through onPressReference.
 */
export const SourcesSheet: React.FC<Props> = ({ refs, onClose, onPressReference }) => (
  <Modal visible={refs !== null} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}>
      {/* Swallows taps so a press inside the sheet does not dismiss it. */}
      <TouchableOpacity style={styles.sheet} activeOpacity={1}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Sources · {refs?.length ?? 0}</Text>

        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {(refs ?? []).map((ref) => {
            const metaText = (() => {
              if (!ref.navigate) return null;
              if (ref.navigate.target === 'topic') return 'STUDY NOTE';
              const parts: string[] = [];
              if (ref.navigate.semesterId) parts.push(ref.navigate.semesterId.toUpperCase());
              if (ref.navigate.year) parts.push(String(ref.navigate.year));
              if (ref.navigate.questionId) {
                parts.push(ref.navigate.questionId);
              } else {
                parts.push('Full paper');
              }
              return parts.join(' · ');
            })();

            return (
              <TouchableOpacity
                key={ref.index}
                style={styles.sourceRow}
                activeOpacity={0.7}
                disabled={!ref.navigate && !ref.url}
                onPress={() => {
                  onClose();
                  Haptics.selectionAsync().catch(() => {});
                  onPressReference(ref);
                }}
              >
                <View style={styles.sourceIcon}>
                  <Feather
                    name={
                      ref.navigate?.target === 'topic'
                        ? 'book-open'
                        : ref.navigate
                          ? 'file-text'
                          : 'globe'
                    }
                    size={13}
                    color={COLORS.secondary}
                  />
                </View>
                <View style={styles.sourceBody}>
                  <Text style={styles.sourceTitle} numberOfLines={3}>
                    {ref.title || 'Source'}
                  </Text>
                  {metaText ? <Text style={styles.sourceMeta}>{metaText}</Text> : null}
                </View>
                {Boolean(ref.navigate || ref.url) ? (
                  <Feather name="chevron-right" size={16} color={COLORS.textSubtle} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.sheetClose} activeOpacity={0.7} onPress={onClose}>
          <Text style={styles.sheetCloseText}>Close</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 48, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    // Capped so a span citing many papers still leaves the page behind visible.
    maxHeight: '70%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  sheetList: {
    flexGrow: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderLight,
  },
  sourceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBody: {
    flex: 1,
    gap: 3,
  },
  sourceTitle: {
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    lineHeight: rf(18),
    color: COLORS.text,
  },
  sourceMeta: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
  },
  sheetClose: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: COLORS.cardSecondary,
  },
  sheetCloseText: {
    fontFamily: FONTS.mono,
    fontSize: rf(12),
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
