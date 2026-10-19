import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, FONTS, RADIUS } from '../../../theme/colors';

export type ChipTone = 'warn' | 'danger' | 'info' | 'ok';

const CHIP: Record<ChipTone, { bg: string; fg: string }> = {
  warn: { bg: '#fef3c7', fg: '#92400e' },
  danger: { bg: '#fee2e2', fg: '#991b1b' },
  info: { bg: '#e0f2fe', fg: '#075985' },
  ok: { bg: '#dcfce7', fg: '#166534' },
};

export const Chip: React.FC<{ label: string; tone?: ChipTone }> = ({ label, tone = 'info' }) => (
  <View style={[styles.chip, { backgroundColor: CHIP[tone].bg }]}>
    <Text style={[styles.chipText, { color: CHIP[tone].fg }]}>{label}</Text>
  </View>
);

export const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : (name[0] ?? '?')).toUpperCase();
};

interface Props {
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  time?: string;
  chips?: Array<{ label: string; tone?: ChipTone }>;
  body?: string;
  images?: string[];
  /** Tapping the text (usually opens the post). */
  onPressBody?: () => void;
  /** The buttons along the bottom: Approve, Remove ... */
  children?: React.ReactNode;
}

/** One thing waiting for a moderator, in the same card style as the community feed. */
export const ModerationCard: React.FC<Props> = ({
  name,
  subtitle,
  avatarUrl,
  time,
  chips,
  body,
  images,
  onPressBody,
  children,
}) => (
  <View style={styles.card}>
    <View style={styles.headerRow}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{initialsOf(name)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {time ? <Text style={styles.time}>• {time}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>

    {chips && chips.length > 0 ? (
      <View style={styles.chipRow}>
        {chips.map((c) => (
          <Chip key={c.label} label={c.label} tone={c.tone} />
        ))}
      </View>
    ) : null}

    {body ? (
      <TouchableOpacity activeOpacity={onPressBody ? 0.7 : 1} onPress={onPressBody} disabled={!onPressBody}>
        <Text style={styles.body} numberOfLines={8}>
          {body}
        </Text>
      </TouchableOpacity>
    ) : null}

    {images && images.length > 0 ? (
      <View style={styles.imageRow}>
        {images.slice(0, 4).map((uri) => (
          <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
        ))}
        {images.length > 4 ? <Text style={styles.more}>+{images.length - 4}</Text> : null}
      </View>
    ) : null}

    {children ? <View style={styles.actions}>{children}</View> : null}
  </View>
);

/** A button along the bottom of a card. `primary` is the safe, expected choice. */
export const CardButton: React.FC<{
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'neutral';
  disabled?: boolean;
}> = ({ label, onPress, tone = 'neutral', disabled }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
    accessibilityRole="button"
    style={[
      styles.button,
      tone === 'primary' && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
      tone === 'danger' && { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
      disabled && { opacity: 0.5 },
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        tone === 'primary' && { color: '#ffffff' },
        tone === 'danger' && { color: '#b91c1c' },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryLight },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontFamily: FONTS.displayBold, fontSize: 14, color: COLORS.primary },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontFamily: FONTS.bodySemi, fontSize: 14.5, color: COLORS.text, flexShrink: 1 },
  time: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSubtle },
  subtitle: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full },
  chipText: { fontFamily: FONTS.bodySemi, fontSize: 11.5 },
  body: { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21, color: COLORS.text },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thumb: { width: 64, height: 64, borderRadius: RADIUS.md, backgroundColor: '#f3f4f6' },
  more: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  buttonText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: '#374151' },
});
