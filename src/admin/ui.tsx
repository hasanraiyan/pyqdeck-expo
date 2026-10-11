import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../theme/colors';

// Small shared pieces for the admin screens, kept plain on purpose: these are
// working tools, not marketing screens.

export const AdminScroll = ({
  children,
  refreshControl,
}: {
  children: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) => {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={s.screen}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
    >
      {children}
    </ScrollView>
  );
};

export const Card = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <View style={s.card}>
    {title ? <Text style={s.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

export const Line = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <View style={s.line}>
    <Text style={s.lineLabel}>{label}</Text>
    <Text style={s.lineValue}>{value === null || value === undefined ? '-' : String(value)}</Text>
  </View>
);

export const Field = ({ label, ...props }: { label: string } & TextInputProps) => (
  <View style={{ gap: 4 }}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      placeholderTextColor={COLORS.textSubtle}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[s.input, props.multiline && { minHeight: 70, textAlignVertical: 'top' }, props.style]}
    />
  </View>
);

export const Btn = ({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) => (
  <TouchableOpacity
    activeOpacity={0.75}
    disabled={disabled || busy}
    onPress={onPress}
    style={[
      s.btn,
      kind === 'secondary' && s.btnSecondary,
      kind === 'danger' && s.btnDanger,
      (disabled || busy) && { opacity: 0.45 },
    ]}
  >
    {busy ? (
      <ActivityIndicator color={kind === 'secondary' ? COLORS.primary : '#fff'} />
    ) : (
      <Text style={[s.btnText, kind === 'secondary' && { color: COLORS.primary }]}>{label}</Text>
    )}
  </TouchableOpacity>
);

export const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]} activeOpacity={0.7}>
    <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
  </TouchableOpacity>
);

export const ToggleRow = ({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <View style={s.toggleRow}>
    <View style={{ flex: 1 }}>
      <Text style={s.toggleLabel}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: COLORS.primary, false: COLORS.border }}
      thumbColor={COLORS.card}
    />
  </View>
);

export const Hint = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.hint}>{children}</Text>
);

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <View style={s.errorBox}>
    <Text style={s.errorText}>{message}</Text>
    {onRetry ? <Btn label="Retry" kind="secondary" onPress={onRetry} /> : null}
  </View>
);

export const Loading = () => (
  <View style={{ padding: 32, alignItems: 'center' }}>
    <ActivityIndicator color={COLORS.primary} />
  </View>
);

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  cardTitle: { fontFamily: FONTS.displayBold, fontSize: 15, color: COLORS.text },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, flexShrink: 1 },
  lineValue: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  fieldLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  btnDanger: { backgroundColor: '#dc2626' },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: '#fff' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  hint: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#991b1b' },
});
