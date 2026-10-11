import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { adminUsers } from '../../api';
import { COLORS, FONTS } from '../../theme/colors';
import { userMessage } from '../../utils/netError';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import { AdminScroll, Btn, Card, ErrorBox, Field, Hint, Line } from '../../admin/ui';

interface Found {
  name: string;
  email: string;
  role: string;
  isBeta: boolean;
}

const when = (v: unknown) => (v ? new Date(String(v)).toLocaleString() : '-');

/**
 * Find an account and help with a problem. Shows counts and settings only - never
 * which topics were ticked, tokens or recents - and hides actions the grants do
 * not allow (the server enforces them regardless).
 */
export const AdminUsersScreen = () => {
  const { tools } = useAdminAccess();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(userMessage(e, 'That did not work.'));
    } finally {
      setBusy(null);
    }
  };

  const search = () =>
    run('find', async () => {
      setSummary(null);
      setNote(null);
      const res = await adminUsers({ action: 'find', query: query.trim() });
      setResults(res.users ?? []);
    });

  const open = (email: string) =>
    run('get', async () => {
      setNote(null);
      setSummary(await adminUsers({ action: 'get', email }));
    });

  const act = (action: 'set_beta' | 'unlink_devices' | 'reset_progress', extra: Record<string, unknown>, text: string) =>
    run(action, async () => {
      const res = await adminUsers({ action, email: summary!.email, ...extra });
      setNote(res.note ?? text);
      setSummary(await adminUsers({ action: 'get', email: summary!.email }));
    });

  const confirmThen = (title: string, message: string, go: () => void) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Do it', style: 'destructive', onPress: go },
    ]);

  return (
    <AdminScroll>
      <Card title="Find an account">
        <Field label="Email, email start (3+ letters) or Clerk id" value={query} onChangeText={setQuery} placeholder="asha@example.com" onSubmitEditing={() => query.trim().length >= 3 && void search()} />
        <Btn label="Search" disabled={query.trim().length < 3} busy={busy === 'find'} onPress={() => void search()} />
      </Card>

      {error && <ErrorBox message={error} />}

      {results && !summary && (
        <Card title={`${results.length} match${results.length === 1 ? '' : 'es'}`}>
          {results.map((u) => (
            <TouchableOpacity key={u.email} onPress={() => void open(u.email)} style={{ paddingVertical: 6 }}>
              <Text style={{ fontFamily: FONTS.bodySemi, color: COLORS.text }}>{u.name}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>
                {u.email} · {u.role}
                {u.isBeta ? ' · beta' : ''}
              </Text>
            </TouchableOpacity>
          ))}
          {results.length === 0 && <Hint>No account matches.</Hint>}
        </Card>
      )}

      {summary && (
        <>
          <Card title={summary.name}>
            <Line label="Email" value={summary.email} />
            <Line label="Role / beta" value={`${summary.role} / ${summary.isBeta ? 'yes' : 'no'}`} />
            <Line label="Signed up" value={when(summary.signedUpAt)} />
            <Line label="Last active" value={when(summary.lastActiveAt)} />
          </Card>
          <Card title="Account data (counts only)">
            <Line label="Progress records (done)" value={`${summary.progress?.records} (${summary.progress?.done})`} />
            <Line label="Subjects started" value={summary.progress?.subjects} />
            <Line label="Last progress change" value={when(summary.progress?.lastChangeAt)} />
            <Line label="Devices linked" value={summary.devicesLinkedToAccount} />
            <Line label="Votes (solutions / notes)" value={`${summary.votes?.solutions} / ${summary.votes?.notes}`} />
            <Line label="Reports (solutions / notes)" value={`${summary.reports?.solutions} / ${summary.reports?.notes}`} />
          </Card>
          <Card title="Their settings">
            <Line label="Ask AI engine" value={summary.settings?.askAiEngine} />
            <Line label="Reading layout" value={summary.settings?.readingLayout} />
            <Line label="Volume scroll" value={summary.settings?.volumeScroll} />
            <Line label="Syllabus branch" value={summary.settings?.syllabusBranch} />
          </Card>

          {(can(tools, 'manage_users', 'set_beta') ||
            can(tools, 'manage_users', 'unlink_devices') ||
            can(tools, 'manage_users', 'reset_progress')) && (
            <Card title="Actions">
              {can(tools, 'manage_users', 'set_beta') && (
                <Btn
                  label={summary.isBeta ? 'Remove from beta' : 'Add to beta'}
                  kind="secondary"
                  busy={busy === 'set_beta'}
                  onPress={() => void act('set_beta', { value: !summary.isBeta }, 'Beta flag updated.')}
                />
              )}
              {can(tools, 'manage_users', 'unlink_devices') && (
                <>
                  <Btn
                    label="Unlink devices from account"
                    kind="danger"
                    busy={busy === 'unlink_devices'}
                    onPress={() =>
                      confirmThen(
                        'Unlink devices?',
                        'Account notifications stop reaching their phones. The phones stay registered for general announcements.',
                        () => void act('unlink_devices', { confirm: true }, 'Devices unlinked.')
                      )
                    }
                  />
                  <Hint>For a student getting someone else's notifications on a shared phone.</Hint>
                </>
              )}
              {can(tools, 'manage_users', 'reset_progress') && (
                <>
                  <Btn
                    label="Reset synced progress"
                    kind="danger"
                    busy={busy === 'reset_progress'}
                    onPress={() =>
                      confirmThen(
                        'Reset synced progress?',
                        `Deletes ${summary.progress?.records} synced record(s) for this account. Their phones keep their own local copy and only re-send a topic if the student changes it. This cannot be undone.`,
                        () => void act('reset_progress', { confirm: true }, 'Progress reset.')
                      )
                    }
                  />
                </>
              )}
            </Card>
          )}

          {note && <Card title="Result"><Text>{note}</Text></Card>}
          <Btn label="Back to results" kind="secondary" onPress={() => { setSummary(null); setNote(null); }} />
        </>
      )}
      <View style={{ height: 8 }} />
    </AdminScroll>
  );
};
