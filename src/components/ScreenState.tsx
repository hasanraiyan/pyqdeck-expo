import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';

/**
 * The loading / error / empty states the syllabus screens share.
 *
 * The loading placeholder lives in Skeletons.tsx now - each syllabus screen
 * shows a skeleton shaped like its own content instead of a spinner - so this
 * file keeps the two states that carry real copy. Kept together because they
 * are really one decision: "there is nothing to render yet, here is why".
 */
export const ScreenError = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <View style={styles.center}>
    <Feather name="wifi-off" size={22} color={COLORS.textSubtle} />
    <Text style={styles.errorText}>{message}</Text>
    {onRetry && (
      <TouchableOpacity style={styles.retry} activeOpacity={0.7} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const ScreenEmpty = ({ message }: { message: string }) => (
  <View style={styles.emptyBox}>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  errorText: {
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retry: {
    marginTop: 4,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontFamily: FONTS.mono, fontSize: 11.5, fontWeight: '700', color: COLORS.primary },
  emptyBox: {
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderDashed,
    borderRadius: 4,
  },
  emptyText: { fontSize: 13.5, lineHeight: 19, color: COLORS.textMuted },
});
