import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import { AdminScroll, Loading, Notice, PageHeader, Section } from '../../admin/ui';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../theme/colors';
import { useAppConfig } from '../../config/useAppConfig';

type Icon = React.ComponentProps<typeof Feather>['name'];

interface AdminToolDef {
  show: boolean;
  icon: Icon;
  label: string;
  subtitle: string;
  to: string;
  accent: string;
  accentBg: string;
  tag?: string;
}

/** Modernized Admin Control Center with categorized operations and platform management. */
export const AdminHomeScreen = ({ navigation }: any) => {
  const { loading, isAdmin, tools, name } = useAdminAccess();
  const { flags } = useAppConfig();

  if (loading) return <Loading label="Verifying administrator credentials" />;

  if (!isAdmin) {
    return (
      <AdminScroll>
        <PageHeader title="Admin Console" kicker="Restricted" />
        <Section>
          <Notice tone="danger" title="Access Denied">
            This area is restricted to authenticated administrator accounts.
          </Notice>
        </Section>
      </AdminScroll>
    );
  }

  const operationsTools: AdminToolDef[] = [
    {
      show: can(tools, 'manage_papers', 'read') || can(tools, 'manage_papers'),
      icon: 'file-text' as const,
      label: 'Paper Submissions',
      subtitle: 'Review student-contributed question papers and manage approvals',
      to: 'AdminContributions',
      accent: '#d97706',
      accentBg: '#fef3c7',
      tag: flags.paperUploadEnabled === false ? 'Uploads Paused' : 'Active Ingest',
    },
    {
      show: can(tools, 'manage_users', 'find'),
      icon: 'users' as const,
      label: 'User Support',
      subtitle: 'Lookup students, inspect device states, and troubleshoot issues',
      to: 'AdminUsers',
      accent: '#2563eb',
      accentBg: '#eff6ff',
    },
    {
      show: can(tools, 'send_notification'),
      icon: 'send' as const,
      label: 'Push Broadcast',
      subtitle: 'Segment audiences and broadcast push notifications to devices',
      to: 'AdminNotify',
      accent: '#7c3aed',
      accentBg: '#f5f3ff',
    },
  ].filter((t) => t.show);

  const platformTools: AdminToolDef[] = [
    {
      show: can(tools, 'app_insights') || can(tools, 'audit_log'),
      icon: 'bar-chart-2' as const,
      label: 'Dashboard & Insights',
      subtitle: 'Account telemetry, sync metrics, and audit log history',
      to: 'AdminDashboard',
      accent: '#059669',
      accentBg: '#ecfdf5',
    },
    {
      show: can(tools, 'manage_app_config', 'read'),
      icon: 'sliders' as const,
      label: 'Remote Config & Switches',
      subtitle: 'Home banner, min app version, and feature emergency kill switches',
      to: 'AdminConfig',
      accent: COLORS.primary,
      accentBg: COLORS.primaryLight,
      tag: 'Kill Switches',
    },
    {
      show: can(tools, 'manage_ai_overview', 'status') || can(tools, 'manage_ai_overview', 'toggle'),
      icon: 'cpu' as const,
      label: 'AI & Embeddings Engine',
      subtitle: 'Manage AI overview toggles, follow-ups, and chat quotas',
      to: 'AdminAi',
      accent: '#0891b2',
      accentBg: '#ecfeff',
    },
  ].filter((t) => t.show);

  const handleToolPress = (screen: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate(screen);
  };

  const renderToolCard = (t: AdminToolDef) => (
    <Pressable
      key={t.to}
      onPress={() => handleToolPress(t.to)}
      style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
      accessibilityRole="button"
      accessibilityLabel={t.label}
    >
      <View style={[styles.toolIconWrap, { backgroundColor: t.accentBg }]}>
        <Feather name={t.icon} size={20} color={t.accent} />
      </View>
      <View style={styles.toolContent}>
        <View style={styles.toolHeaderRow}>
          <Text style={styles.toolTitle}>{t.label}</Text>
          {t.tag ? (
            <View style={[styles.tagBadge, { backgroundColor: t.accentBg }]}>
              <Text style={[styles.tagText, { color: t.accent }]}>{t.tag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.toolSubtitle} numberOfLines={2}>
          {t.subtitle}
        </Text>
      </View>
      <View style={styles.chevronWrap}>
        <Feather name="chevron-right" size={18} color={COLORS.textSubtle} />
      </View>
    </Pressable>
  );

  return (
    <AdminScroll>
      <PageHeader
        kicker="System Administration"
        title="Admin Console"
        icon="shield"
        badge={
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        }
      />

      {/* Admin Profile & Health Summary Banner */}
      <View style={styles.heroSummaryCard}>
        <View style={styles.adminInfoRow}>
          <View style={styles.avatarCircle}>
            <Feather name="user-check" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.adminInfoTextWrap}>
            <Text style={styles.adminNameText}>{name || 'System Administrator'}</Text>
            <Text style={styles.adminRoleText}>Full Access · Security Audited</Text>
          </View>
        </View>

        {/* Live Switches Bar */}
        <View style={styles.statusChipsContainer}>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: flags.syncEnabled ? '#16a34a' : '#dc2626' }]} />
            <Text style={styles.statusChipText}>Sync: {flags.syncEnabled ? 'Active' : 'Paused'}</Text>
          </View>
          <View style={styles.statusChip}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: flags.paperUploadEnabled !== false ? '#16a34a' : '#d97706' },
              ]}
            />
            <Text style={styles.statusChipText}>
              Uploads: {flags.paperUploadEnabled !== false ? 'Active' : 'Paused'}
            </Text>
          </View>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: flags.adsEnabled ? '#16a34a' : '#6b7280' }]} />
            <Text style={styles.statusChipText}>Ads: {flags.adsEnabled ? 'On' : 'Off'}</Text>
          </View>
        </View>
      </View>

      {/* Operations & Community */}
      {operationsTools.length > 0 && (
        <Section title="Operations & Student Submissions">
          {operationsTools.map(renderToolCard)}
        </Section>
      )}

      {/* Platform & System Management */}
      {platformTools.length > 0 && (
        <Section title="Platform Controls & Insights">
          {platformTools.map(renderToolCard)}
        </Section>
      )}

      {/* Security Audit Footnote */}
      <View style={styles.footnoteSection}>
        <Feather name="lock" size={13} color={COLORS.textSubtle} />
        <Text style={styles.footnoteText}>
          All mutations and configuration changes are cryptographically audited with timestamp and admin credentials.
        </Text>
      </View>
    </AdminScroll>
  );
};

const styles = StyleSheet.create({
  heroSummaryCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
    ...SHADOWS.subtle,
  },
  adminInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminInfoTextWrap: {
    flex: 1,
    gap: 2,
  },
  adminNameText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 15,
    color: COLORS.text,
  },
  adminRoleText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderColor: 'rgba(22, 163, 74, 0.25)',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  liveBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 10,
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: 15,
    ...SHADOWS.subtle,
  },
  toolCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.995 }],
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolContent: {
    flex: 1,
    gap: 3,
  },
  toolHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toolTitle: {
    fontFamily: FONTS.bodySemi,
    fontSize: 15,
    color: COLORS.text,
  },
  tagBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  toolSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
  },
  chevronWrap: {
    paddingLeft: 4,
  },
  footnoteSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 10,
  },
  footnoteText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSubtle,
  },
});
