import React from 'react';
import { Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import { AdminScroll, Loading, Notice, PageHeader, Section, Card } from '../../admin/ui';
import { COLORS, FONTS } from '../../theme/colors';
import { Pressable, View } from 'react-native';

type Icon = React.ComponentProps<typeof Feather>['name'];

/** The admin area's front page: one tappable card per tool this account may use. */
export const AdminHomeScreen = ({ navigation }: any) => {
  const { loading, isAdmin, tools, name } = useAdminAccess();

  if (loading) return <Loading label="Checking your access" />;

  if (!isAdmin) {
    return (
      <AdminScroll>
        <PageHeader title="Admin tools" />
        <Section>
          <Notice tone="info">These tools are only available to admin accounts.</Notice>
        </Section>
      </AdminScroll>
    );
  }

  const tools_ = [
    {
      show: can(tools, 'app_insights') || can(tools, 'audit_log'),
      icon: 'bar-chart-2' as Icon,
      label: 'Dashboard',
      subtitle: 'Accounts, sync, devices and recent admin actions',
      to: 'AdminDashboard',
    },
    {
      show: can(tools, 'send_notification'),
      icon: 'send' as Icon,
      label: 'Send notification',
      subtitle: 'Preview the audience, then send a push',
      to: 'AdminNotify',
    },
    {
      show: can(tools, 'manage_users', 'find'),
      icon: 'users' as Icon,
      label: 'User support',
      subtitle: 'Find a student and help with a problem',
      to: 'AdminUsers',
    },
    {
      show: can(tools, 'manage_papers', 'read') || can(tools, 'manage_papers'),
      icon: 'file-text' as Icon,
      label: 'Paper submissions',
      subtitle: 'Review student contributed exam papers and download files',
      to: 'AdminContributions',
    },
    {
      show: can(tools, 'manage_app_config', 'read'),
      icon: 'sliders' as Icon,
      label: 'App config',
      subtitle: 'Banner, versions and sync switches',
      to: 'AdminConfig',
    },
    {
      show: can(tools, 'manage_ai_overview', 'status') || can(tools, 'manage_ai_overview', 'toggle'),
      icon: 'cpu' as Icon,
      label: 'AI features',
      subtitle: 'AI overview, follow-ups and chat switches, usage',
      to: 'AdminAi',
    },
  ].filter((t) => t.show);

  return (
    <AdminScroll>
      <PageHeader title="Admin tools" summary={`Signed in as ${name || 'admin'}.`} />
      <Section>
        {tools_.length === 0 ? (
          <Notice tone="info">No admin tools are granted to this account.</Notice>
        ) : (
          tools_.map((t) => (
            <Pressable
              key={t.to}
              onPress={() => navigation.navigate(t.to)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: COLORS.card,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 14,
                padding: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: COLORS.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name={t.icon} size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 15, color: COLORS.text }}>{t.label}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>{t.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={COLORS.textSubtle} />
            </Pressable>
          ))
        )}
      </Section>
      <Section>
        <Card>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, lineHeight: 18, color: COLORS.textMuted }}>
            The server checks what you may do on every action and records changes in the audit log.
          </Text>
        </Card>
      </Section>
    </AdminScroll>
  );
};
