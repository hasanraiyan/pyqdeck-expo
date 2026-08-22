import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from '../utils/responsive';

type Props = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
  last?: boolean;
};

export const SettingsRow = ({ icon, label, subtitle, onPress, right, disabled, last }: Props) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.row, !last && styles.rowBorder, disabled && styles.rowDisabled]}
      activeOpacity={0.6}
      onPress={onPress}
      disabled={disabled || !onPress}
    >
      <View style={styles.iconBox}>
        <Feather name={icon} size={17} color={disabled ? COLORS.textSubtle : COLORS.textMuted} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right !== undefined ? (
        <View style={styles.right}>{right}</View>
      ) : onPress ? (
        <Feather name="chevron-right" size={18} color={COLORS.textSubtle} />
      ) : null}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  iconBox: {
    width: 30,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: rf(14),
    color: COLORS.text,
    fontWeight: '500',
  },
  labelDisabled: {
    color: COLORS.textMuted,
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.textSubtle,
    marginTop: 2,
  },
  right: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
});
