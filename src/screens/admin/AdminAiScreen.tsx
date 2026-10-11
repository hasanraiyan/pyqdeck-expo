import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { adminAiStatus, adminAiToggle, adminAiUsage } from '../../api';
import { userMessage } from '../../utils/netError';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import {
  AdminScroll,
  Btn,
  Card,
  EmptyState,
  Fact,
  Hint,
  Loading,
  Notice,
  PageHeader,
  Pill,
  Section,
  StatTile,
  TileGrid,
  ToggleRow,
  num,
} from '../../admin/ui';

type Feature = 'overview' | 'followups' | 'chat';

const NAMES: Record<Feature, { title: string; hint: string }> = {
  overview: {
    title: 'AI overview',
    hint: 'The answer card on search. Turning it off also turns off follow-ups and chat.',
  },
  followups: { title: 'Follow-up questions', hint: 'Suggested follow-up chips under an answer.' },
  chat: { title: 'AI chat', hint: 'Multi-turn chat for signed-in students. Off until you enable it.' },
};

/** Live switches for the AI features, with this week's usage and cost signals. */
export const AdminAiScreen = () => {
  const { tools } = useAdminAccess();
  const canStatus = can(tools, 'manage_ai_overview', 'status');
  const canToggle = can(tools, 'manage_ai_overview', 'toggle');
  const canUsage = can(tools, 'manage_ai_overview', 'usage');
  const [status, setStatus] = useState<Record<string, any> | null>(null);
  const [usage, setUsage] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Feature | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [st, us] = await Promise.all([
        canStatus ? adminAiStatus() : Promise.resolve(null),
        canUsage ? adminAiUsage('overview', 7) : Promise.resolve(null),
      ]);
      setStatus(st);
      setUsage(us);
    } catch (e) {
      setError(userMessage(e, 'Could not load the AI settings.'));
    } finally {
      setLoading(false);
    }
  }, [canStatus, canUsage]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (feature: Feature, enabled: boolean) => {
    setBusy(feature);
    setError(null);
    try {
      setStatus(await adminAiToggle(feature, enabled));
    } catch (e) {
      setError(userMessage(e, 'Could not change that.'));
    } finally {
      setBusy(null);
    }
  };

  const flip = (feature: Feature, enabled: boolean) => {
    if (feature === 'overview' && !enabled) {
      Alert.alert(
        'Turn off the AI overview?',
        'Follow-ups and chat turn off too, and students see search results without an answer card.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn off', style: 'destructive', onPress: () => void apply(feature, false) },
        ]
      );
      return;
    }
    void apply(feature, enabled);
  };

  if (loading) return <Loading label="Loading AI settings" />;

  return (
    <AdminScroll>
      <PageHeader
        title="AI features"
        summary="Switches take effect within about a minute, without a new app release."
      />

      {error && (
        <Section>
          <Notice tone="danger" onRetry={() => void load()}>
            {error}
          </Notice>
        </Section>
      )}

      {status && (
        <>
          {status.envEnabled === false && (
            <Section>
              <Notice tone="warn" title="Off in the server configuration">
                The AI overview is disabled by the server settings. The switches below cannot turn it on until that changes.
              </Notice>
            </Section>
          )}

          <Section title="Switches">
            {(['overview', 'followups', 'chat'] as Feature[]).map((f) => {
              const entry = f === 'overview' ? status : status[f];
              const on = !!entry?.dbEnabled;
              const live = !!entry?.live;
              return (
                <Card key={f}>
                  <ToggleRow
                    label={NAMES[f].title}
                    hint={NAMES[f].hint}
                    value={on}
                    disabled={!canToggle || busy !== null}
                    onChange={(v) => flip(f, v)}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Pill
                      label={live ? 'Live for students' : 'Not live'}
                      tone={live ? 'ok' : 'neutral'}
                      icon={live ? 'radio' : 'pause'}
                    />
                  </View>
                </Card>
              );
            })}
          </Section>

          {status.chat?.dailyCap ? (
            <Section title="Chat limit">
              <Card>
                <Fact label="Daily turn cap (all students)" value={num(status.chat.dailyCap)} />
              </Card>
            </Section>
          ) : null}
        </>
      )}

      {usage && (
        <Section title="Last 7 days · AI overview">
          <TileGrid>
            <StatTile label="Answers requested" value={num(usage.calls)} />
            <StatTile label="Billed lookups" value={num(usage.billedCalls)} hint="cache misses cost money" />
            <StatTile
              label="Served from cache"
              value={usage.cacheHitRate == null ? '-' : `${Math.round(usage.cacheHitRate * 100)}%`}
            />
            <StatTile label="Average speed" value={usage.avgLatencyMs == null ? '-' : `${usage.avgLatencyMs} ms`} />
          </TileGrid>
          {Array.isArray(usage.topQueries) && usage.topQueries.length > 0 ? (
            <Card>
              {usage.topQueries.slice(0, 8).map((q: any, i: number) => (
                <Fact key={`${q.query}-${i}`} label={q.query} value={num(q.calls)} />
              ))}
            </Card>
          ) : (
            <EmptyState icon="message-circle" title="No questions this week" />
          )}
        </Section>
      )}

      {!canStatus && (
        <Section>
          <Hint>Your account can change these switches but cannot read their current state.</Hint>
        </Section>
      )}
      {(canStatus || canUsage) && (
        <Section>
          <Btn label="Refresh" kind="secondary" icon="refresh-cw" busy={busy !== null} onPress={() => void load()} />
        </Section>
      )}
    </AdminScroll>
  );
};
