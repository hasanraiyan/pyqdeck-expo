import React from 'react';
import { Text } from 'react-native';
import { SettingsRow } from '../../components/SettingsRow';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import { AdminScroll, Card, Hint, Loading } from '../../admin/ui';

/** Lists only the admin screens this account's grants allow. */
export const AdminHomeScreen = ({ navigation }: any) => {
  const { loading, isAdmin, tools, name } = useAdminAccess();

  if (loading) return <Loading />;
  if (!isAdmin) {
    return (
      <AdminScroll>
        <Card>
          <Text>Admin tools are not available for this account.</Text>
        </Card>
      </AdminScroll>
    );
  }

  const rows = [
    {
      show: can(tools, 'app_insights') || can(tools, 'audit_log'),
      icon: 'bar-chart-2' as const,
      label: 'Dashboard & audit log',
      subtitle: 'Accounts, sync, devices, recent admin actions',
      to: 'AdminDashboard',
    },
    {
      show: can(tools, 'send_notification'),
      icon: 'send' as const,
      label: 'Send notification',
      subtitle: 'Preview recipients, then send',
      to: 'AdminNotify',
    },
    {
      show: can(tools, 'manage_users', 'find'),
      icon: 'users' as const,
      label: 'User support',
      subtitle: 'Find an account and help with a problem',
      to: 'AdminUsers',
    },
    {
      show: can(tools, 'manage_app_config', 'read'),
      icon: 'sliders' as const,
      label: 'App config',
      subtitle: 'Banner, minimum version, kill switches',
      to: 'AdminConfig',
    },
  ].filter((r) => r.show);

  return (
    <AdminScroll>
      <Hint>
        Signed in as {name || 'admin'}. Everything here uses your normal account; the server
        checks what you may do on every action and records changes in the audit log.
      </Hint>
      <Card>
        {rows.map((r) => (
          <SettingsRow
            key={r.to}
            icon={r.icon}
            label={r.label}
            subtitle={r.subtitle}
            onPress={() => navigation.navigate(r.to)}
            last={false}
          />
        ))}
        {rows.length === 0 && <Text>No admin tools are granted to this account.</Text>}
      </Card>
    </AdminScroll>
  );
};
