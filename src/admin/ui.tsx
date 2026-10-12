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
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';
import { useAdminAccess } from './useAdminAccess';
import { can } from './adminLogic';

// Shared pieces for the admin screens. One visual language everywhere: a page
// header, titled sections, stat tiles, status pills, and the same empty, loading
// and error states. Colours and fonts come from the app theme so the admin area
// reads as part of PyQdeck.

const DANGER = '#b91c1c';
const DANGER_BG = '#fef2f2';
const DANGER_BORDER = '#fecaca';
const WARN = '#92400e';
const WARN_BG = '#fef3c7';
const WARN_BORDER = '#fcd34d';
const OK = COLORS.success;
const OK_BG = 'rgba(22, 163, 74, 0.1)';

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
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      {children}
    </ScrollView>
  );
};

/** Top of every admin page: a kicker, a title, and an optional one-line summary. */
export const PageHeader = ({
  kicker = 'Admin',
  title,
  summary,
}: {
  kicker?: string;
  title: string;
  summary?: string;
}) => (
  <View style={s.header}>
    <Text style={s.kicker}>{kicker.toUpperCase()}</Text>
    <Text style={s.title}>{title}</Text>
    {summary ? <Text style={s.summary}>{summary}</Text> : null}
  </View>
);

/** A titled group of content with consistent spacing. */
export const Section = ({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <View style={s.section}>
    {title || action ? (
      <View style={s.sectionHead}>
        {title ? <Text style={s.sectionTitle}>{title}</Text> : <View />}
        {action}
      </View>
    ) : null}
    <View style={s.sectionBody}>{children}</View>
  </View>
);

/**
 * A plain card box. Place it inside a Section's body - it carries no page
 * margin or side padding of its own, so a `<Section><Card>` nest keeps the
 * single 16pt page inset and one title-to-card gap instead of doubling both.
 */
export const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={s.card}>{children}</View>
);

/** Big number with a label: the building block of the dashboard. */
export const StatTile = ({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'ok' | 'danger';
}) => (
  <View style={[s.tile, tone === 'danger' && s.tileDanger]}>
    <Text style={s.tileLabel}>{label}</Text>
    <Text style={[s.tileValue, tone === 'danger' && { color: DANGER }]}>{value}</Text>
    {hint ? <Text style={s.tileHint}>{hint}</Text> : null}
  </View>
);

export const TileGrid = ({ children }: { children: React.ReactNode }) => (
  <View style={s.grid}>{children}</View>
);

/** Small coloured status label. */
export const Pill = ({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'primary';
  icon?: React.ComponentProps<typeof Feather>['name'];
}) => {
  const palette = {
    neutral: { bg: COLORS.cardSecondary, fg: COLORS.textMuted, bd: COLORS.border },
    ok: { bg: OK_BG, fg: '#15803d', bd: 'rgba(22,163,74,0.3)' },
    warn: { bg: WARN_BG, fg: WARN, bd: WARN_BORDER },
    danger: { bg: DANGER_BG, fg: DANGER, bd: DANGER_BORDER },
    primary: { bg: COLORS.primaryLight, fg: COLORS.primary, bd: COLORS.primaryBorder },
  }[tone];
  return (
    <View style={[s.pill, { backgroundColor: palette.bg, borderColor: palette.bd }]}>
      {icon ? <Feather name={icon} size={11} color={palette.fg} /> : null}
      <Text style={[s.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
};

/** A label and value on one row, for facts about a record. */
export const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <View style={s.fact}>
    <Text style={s.factLabel}>{label}</Text>
    <Text style={s.factValue}>
      {value === null || value === undefined || value === '' ? '-' : String(value)}
    </Text>
  </View>
);

export const Line = Fact;

/** Empty-result message with an icon, so an empty list never looks broken. */
export const EmptyState = ({
  icon = 'inbox',
  title,
  body,
}: {
  icon?: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body?: string;
}) => (
  <View style={s.empty}>
    <Feather name={icon} size={22} color={COLORS.textSubtle} />
    <Text style={s.emptyTitle}>{title}</Text>
    {body ? <Text style={s.emptyBody}>{body}</Text> : null}
  </View>
);

export const Field = ({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & TextInputProps) => (
  <View style={{ gap: 6 }}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      placeholderTextColor={COLORS.textSubtle}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[s.input, props.multiline && { minHeight: 84, textAlignVertical: 'top' }, props.style]}
    />
    {hint ? <Text style={s.hint}>{hint}</Text> : null}
  </View>
);

export const Btn = ({
  label,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ComponentProps<typeof Feather>['name'];
}) => {
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : kind === 'ghost' ? COLORS.textMuted : COLORS.primary;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        s.btn,
        kind === 'secondary' && s.btnSecondary,
        kind === 'danger' && s.btnDanger,
        kind === 'ghost' && s.btnGhost,
        (disabled || busy) && { opacity: 0.45 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.btnInner}>
          {icon ? <Feather name={icon} size={15} color={fg} /> : null}
          <Text style={[s.btnText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

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
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <View style={s.toggleRow}>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.toggleLabel}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ true: COLORS.primary, false: COLORS.border }}
      thumbColor={COLORS.card}
    />
  </View>
);

export const Hint = ({ children }: { children: React.ReactNode }) => (
  <Text style={s.hint}>{children}</Text>
);

/**
 * Footer link for the syllabus/notes edit sheets (ASN-FR-31): opens the
 * Dashboard audit log pre-filtered to this tool. Shown only to accounts that
 * may read the audit log; the Dashboard hides its audit section otherwise.
 */
export const AuditLink = ({
  tool,
  label,
  onNavigate,
}: {
  tool: 'manage_syllabus' | 'manage_notes' | 'manage_content' | 'manage_catalog';
  label: string;
  onNavigate: () => void;
}) => {
  const navigation = useNavigation<any>();
  const { tools } = useAdminAccess();
  if (!can(tools, 'audit_log')) return null;
  return (
    <TouchableOpacity
      onPress={() => {
        onNavigate();
        navigation.navigate('AdminDashboard', { tool });
      }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 }}
      accessibilityLabel={label}
    >
      <Feather name="shield" size={13} color={COLORS.primary} />
      <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.primary }}>{label}</Text>
    </TouchableOpacity>
  );
};

/** A notice box: warning (amber), danger (red) or info (neutral). */
export const Notice = ({
  tone = 'info',
  title,
  children,
  onRetry,
}: {
  tone?: 'info' | 'warn' | 'danger';
  title?: string;
  children?: React.ReactNode;
  onRetry?: () => void;
}) => {
  const c = {
    info: { bg: COLORS.cardSecondary, bd: COLORS.border, fg: COLORS.text, icon: 'info' as const },
    warn: { bg: WARN_BG, bd: WARN_BORDER, fg: WARN, icon: 'alert-triangle' as const },
    danger: { bg: DANGER_BG, bd: DANGER_BORDER, fg: DANGER, icon: 'alert-circle' as const },
  }[tone];
  return (
    <View style={[s.notice, { backgroundColor: c.bg, borderColor: c.bd }]}>
      <Feather name={c.icon} size={16} color={c.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 6 }}>
        {title ? <Text style={[s.noticeTitle, { color: c.fg }]}>{title}</Text> : null}
        {children ? <Text style={[s.noticeBody, { color: c.fg }]}>{children}</Text> : null}
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Text style={[s.noticeTitle, { color: c.fg, textDecorationLine: 'underline' }]}>Try again</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <Notice tone="danger" onRetry={onRetry}>
    {message}
  </Notice>
);

/** Loading placeholder that matches the page rhythm. */
export const Loading = ({ label = 'Loading' }: { label?: string }) => (
  <View style={{ padding: 40, alignItems: 'center', gap: 10 }}>
    <ActivityIndicator color={COLORS.primary} />
    <Text style={s.hint}>{label}…</Text>
  </View>
);

/** Fixed bar at the bottom of a page that has unsaved changes. */
export const ActionBar = ({
  dirtyLabel,
  children,
}: {
  dirtyLabel: string;
  children: React.ReactNode;
}) => (
  <View style={s.actionBar}>
    <Text style={s.actionBarLabel}>{dirtyLabel}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>{children}</View>
  </View>
);

/** A phone-sized preview of how the Home banner will look. */
export const BannerPreview = ({
  message,
  level,
}: {
  message: string;
  level: 'info' | 'warning';
}) => {
  if (!message.trim()) return <Hint>No banner is shown while the message is empty.</Hint>;
  const warning = level === 'warning';
  return (
    <View style={[s.bannerPreview, warning && { backgroundColor: WARN_BG, borderColor: WARN_BORDER }]}>
      <Feather name={warning ? 'alert-triangle' : 'info'} size={15} color={warning ? WARN : COLORS.primary} />
      <Text style={[s.bannerPreviewText, warning && { color: '#78350f' }]}>{message}</Text>
    </View>
  );
};

export const formatWhen = (v: unknown) => {
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

export const num = (n: unknown) => (typeof n === 'number' ? n.toLocaleString() : '-');

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 4 },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: COLORS.primary },
  title: { fontFamily: FONTS.displayBold, fontSize: 24, color: COLORS.text },
  summary: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: COLORS.textMuted },
  section: { paddingHorizontal: 16, marginTop: 18, gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  sectionBody: { gap: 10 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 4,
  },
  tileDanger: { borderColor: DANGER_BORDER, backgroundColor: DANGER_BG },
  tileLabel: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.textMuted },
  tileValue: { fontFamily: FONTS.displayBold, fontSize: 24, color: COLORS.text },
  tileHint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillText: { fontFamily: FONTS.bodySemi, fontSize: 11 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  factLabel: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, flexShrink: 1 },
  factValue: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  emptyTitle: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  emptyBody: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
  fieldLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  btnSecondary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.primaryBorder },
  btnDanger: { backgroundColor: DANGER },
  btnGhost: { backgroundColor: 'transparent' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14 },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleLabel: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  hint: { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17, color: COLORS.textMuted },
  notice: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  noticeTitle: { fontFamily: FONTS.bodySemi, fontSize: 13 },
  noticeBody: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBarLabel: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.text, flexShrink: 1 },
  bannerPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSecondary,
  },
  bannerPreviewText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
});
