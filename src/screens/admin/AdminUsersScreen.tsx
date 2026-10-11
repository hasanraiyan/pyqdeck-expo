import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { adminUsers } from '../../api';
import { COLORS, FONTS } from '../../theme/colors';
import { userMessage } from '../../utils/netError';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import {
  AdminScroll,
  Btn,
  Card,
  EmptyState,
  Fact,
  Field,
  formatWhen,
  Hint,
  Notice,
  PageHeader,
  Pill,
  Section,
  StatTile,
  TileGrid,
} from '../../admin/ui';

interface Found {
  name: string;
  email: string;
  role: string;
  isBeta: boolean;
  adFree: boolean;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Find a student, see a support summary of counts and settings (never which
 * topics were ticked, tokens or recents), and take the actions their grants allow.
 */
export const AdminUsersScreen = () => {
  const { tools } = useAdminAccess();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[] | null>(null);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const canBeta = can(tools, 'manage_users', 'set_beta');
  const canAdFree = can(tools, 'manage_users', 'set_ad_free');
  const canUnlink = can(tools, 'manage_users', 'unlink_devices');
  const canReset = can(tools, 'manage_users', 'reset_progress');

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

  const act = (
    action: 'set_beta' | 'set_ad_free' | 'unlink_devices' | 'reset_progress',
    extra: Record<string, unknown>,
    fallback: string
  ) =>
    run(action, async () => {
      const res = await adminUsers({ action, email: summary!.email, ...extra });
      setNote(res.note ?? fallback);
      setSummary(await adminUsers({ action: 'get', email: summary!.email }));
    });

  const confirmThen = (title: string, message: string, go: () => void) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', style: 'destructive', onPress: go },
    ]);

  const closeSummary = () => {
    setSummary(null);
    setNote(null);
  };

  if (summary) {
    return (
      <AdminScroll>
        <PageHeader kicker="User support" title={summary.name || 'Account'} summary={summary.email} />

        <Section>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pill label={summary.role} tone="primary" />
            {summary.isBeta ? <Pill label="Beta" tone="ok" /> : null}
            {summary.adFree ? <Pill label="Ad-free" tone="ok" icon="eye-off" /> : null}
            {summary.progress?.records > 0 ? <Pill label="Syncing" tone="ok" icon="cloud" /> : <Pill label="No synced progress" />}
          </View>
        </Section>

        {note && (
          <Section>
            <Notice tone="info" title="Done">
              {note}
            </Notice>
          </Section>
        )}
        {error && (
          <Section>
            <Notice tone="danger">{error}</Notice>
          </Section>
        )}

        <Section title="Activity">
          <TileGrid>
            <StatTile label="Topics done" value={summary.progress?.done ?? '-'} hint={`of ${summary.progress?.records ?? 0} records`} />
            <StatTile label="Subjects started" value={summary.progress?.subjects ?? '-'} />
            <StatTile label="Devices linked" value={summary.devicesLinkedToAccount ?? '-'} />
            <StatTile label="Votes" value={`${summary.votes?.solutions ?? 0} / ${summary.votes?.notes ?? 0}`} hint="solutions / notes" />
          </TileGrid>
          <Card>
            <Fact label="Signed up" value={formatWhen(summary.signedUpAt)} />
            <Fact label="Last active" value={formatWhen(summary.lastActiveAt)} />
            <Fact label="Last progress change" value={formatWhen(summary.progress?.lastChangeAt)} />
            <Fact label="Reports (solutions / notes)" value={`${summary.reports?.solutions ?? 0} / ${summary.reports?.notes ?? 0}`} />
          </Card>
        </Section>

        <Section title="Settings on their account">
          <Card>
            <Fact label="Ask AI engine" value={summary.settings?.askAiEngine} />
            <Fact label="Reading layout" value={summary.settings?.readingLayout} />
            <Fact label="Volume-key scroll" value={summary.settings?.volumeScroll === null ? null : summary.settings?.volumeScroll ? 'On' : 'Off'} />
            <Fact label="Syllabus branch" value={summary.settings?.syllabusBranch} />
          </Card>
          <Hint>Topic names, push tokens and recent items are never shown here.</Hint>
        </Section>

        {(canBeta || canAdFree || canUnlink || canReset) && (
          <Section title="Actions">
            {canBeta && (
              <Btn
                label={summary.isBeta ? 'Remove from beta testers' : 'Add to beta testers'}
                kind="secondary"
                icon="star"
                busy={busy === 'set_beta'}
                onPress={() => void act('set_beta', { value: !summary.isBeta }, 'Beta flag updated.')}
              />
            )}
            {canAdFree && (
              <Btn
                label={summary.adFree ? 'Turn ads back on' : 'Make ad-free (hide ads)'}
                kind="secondary"
                icon="eye-off"
                busy={busy === 'set_ad_free'}
                onPress={() => void act('set_ad_free', { value: !summary.adFree }, 'Ad-free flag updated.')}
              />
            )}
            {canUnlink && (
              <Card>
                <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text }}>Unlink devices</Text>
                <Hint>For a shared phone that gets someone else's account notifications. The phones stay registered for general announcements.</Hint>
                <Btn
                  label="Unlink devices"
                  kind="danger"
                  icon="smartphone"
                  busy={busy === 'unlink_devices'}
                  onPress={() =>
                    confirmThen(
                      'Unlink devices?',
                      'Account notifications stop reaching their phones.',
                      () => void act('unlink_devices', { confirm: true }, 'Devices unlinked.')
                    )
                  }
                />
              </Card>
            )}
            {canReset && (
              <Card>
                <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text }}>Reset synced progress</Text>
                <Hint>Deletes this account's {summary.progress?.records ?? 0} synced record(s). Their phones keep their own copy and only re-send a topic if they change it. This cannot be undone.</Hint>
                <Btn
                  label="Reset progress"
                  kind="danger"
                  icon="rotate-ccw"
                  busy={busy === 'reset_progress'}
                  onPress={() =>
                    confirmThen(
                      'Reset synced progress?',
                      `Deletes ${summary.progress?.records ?? 0} record(s) for ${summary.email}. This cannot be undone.`,
                      () => void act('reset_progress', { confirm: true }, 'Progress reset.')
                    )
                  }
                />
              </Card>
            )}
          </Section>
        )}

        <Section>
          <Btn label="Back to results" kind="ghost" icon="arrow-left" onPress={closeSummary} />
        </Section>
      </AdminScroll>
    );
  }

  return (
    <AdminScroll>
      <PageHeader kicker="User support" title="Find a student" summary="Search by email, the start of an email, or a Clerk id." />

      <Section>
        <Card>
          <Field
            label="Email or Clerk id"
            value={query}
            onChangeText={setQuery}
            placeholder="asha@example.com"
            returnKeyType="search"
            onSubmitEditing={() => query.trim().length >= 3 && void search()}
          />
          <Btn
            label="Search"
            icon="search"
            disabled={query.trim().length < 3}
            busy={busy === 'find'}
            onPress={() => void search()}
          />
          {query.trim().length > 0 && query.trim().length < 3 && <Hint>Type at least 3 characters.</Hint>}
        </Card>
      </Section>

      {error && (
        <Section>
          <Notice tone="danger">{error}</Notice>
        </Section>
      )}

      {results && (
        <Section title={`${results.length} result${results.length === 1 ? '' : 's'}`}>
          {results.length === 0 ? (
            <EmptyState icon="user-x" title="No account matches" body="Check the spelling, or try the first few letters of the email." />
          ) : (
            results.map((u) => (
              <Pressable
                key={u.email}
                onPress={() => void open(u.email)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: COLORS.card,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 14,
                  padding: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: COLORS.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.primary }}>{initials(u.name)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text }} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }} numberOfLines={1}>
                    {u.email}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {u.isBeta ? <Pill label="Beta" tone="ok" /> : null}
                  {u.adFree ? <Pill label="Ad-free" tone="ok" /> : null}
                  {u.role !== 'student' ? <Pill label={u.role} tone="primary" /> : null}
                </View>
                <Feather name="chevron-right" size={18} color={COLORS.textSubtle} />
              </Pressable>
            ))
          )}
        </Section>
      )}
    </AdminScroll>
  );
};
