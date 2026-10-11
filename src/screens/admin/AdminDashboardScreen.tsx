import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { adminAudit, adminInsights } from '../../api';
import { COLORS, FONTS } from '../../theme/colors';
import { userMessage } from '../../utils/netError';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import { AdminScroll, Btn, Card, ErrorBox, Hint, Line, Loading } from '../../admin/ui';

type Audit = Awaited<ReturnType<typeof adminAudit>>['entries'];

const num = (n: unknown) => (typeof n === 'number' ? n.toLocaleString() : '-');

/** Read-only numbers (app_insights) and the recent admin actions (audit_log). */
export const AdminDashboardScreen = () => {
  const { tools } = useAdminAccess();
  const [insights, setInsights] = useState<Record<string, any> | null>(null);
  const [audit, setAudit] = useState<Audit>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const canInsights = can(tools, 'app_insights');
  const canAudit = can(tools, 'audit_log');

  const load = useCallback(async () => {
    setError(null);
    setAuditError(null);
    const [ins, aud] = await Promise.allSettled([
      canInsights ? adminInsights() : Promise.resolve(null),
      canAudit ? adminAudit({ limit: 30 }) : Promise.resolve(null),
    ]);
    if (ins.status === 'fulfilled') setInsights(ins.value);
    else setError(userMessage(ins.reason, 'Could not load the numbers.'));
    if (aud.status === 'fulfilled' && aud.value) {
      setAudit(aud.value.entries);
      setMore(aud.value.count >= 30);
    } else if (aud.status === 'rejected') {
      setAuditError(userMessage(aud.reason, 'Could not load the audit log.'));
    }
    setLoading(false);
    setRefreshing(false);
  }, [canInsights, canAudit]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await adminAudit({ limit: 30, offset: audit.length });
      setAudit((cur) => [...cur, ...next.entries]);
      setMore(next.count >= 30);
    } catch (e) {
      setAuditError(userMessage(e, 'Could not load more.'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <Loading />;

  const a = insights?.accounts;
  const sy = insights?.sync;
  const dv = insights?.devices;
  const ops = insights?.ops;

  return (
    <AdminScroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={COLORS.primary}
        />
      }
    >
      {error && <ErrorBox message={error} onRetry={() => void load()} />}

      {insights && (
        <>
          <Card title="Accounts">
            <Line label="Total" value={num(a?.total)} />
            <Line label="New (7 / 30 days)" value={`${num(a?.created7d)} / ${num(a?.created30d)}`} />
            <Line label="Active (7 / 30 days)" value={`${num(a?.active7d)} / ${num(a?.active30d)}`} />
          </Card>
          <Card title="Sync">
            <Line label="Accounts with progress" value={num(sy?.accountsWithProgress)} />
            <Line label="Progress records (done)" value={`${num(sy?.progressRecords)} (${num(sy?.doneRecords)})`} />
            <Line
              label="Changed progress (7 / 30 days)"
              value={`${num(sy?.accountsChanged7d)} / ${num(sy?.accountsChanged30d)}`}
            />
            <Line label="Use Jump Back In" value={num(sy?.accountsWithJumpBackIn)} />
            <Line label="Ask AI choices" value={JSON.stringify(sy?.askAiEngineChoices ?? {})} />
            <Line label="Layout choices" value={JSON.stringify(sy?.readingLayoutChoices ?? {})} />
          </Card>
          <Card title="Devices, votes and reports">
            <Line label="Registered devices" value={num(dv?.registered)} />
            <Line label="Linked to an account" value={num(dv?.linkedToAccount)} />
            <Line label="Accounts with 2+ devices" value={num(dv?.accountsWithTwoOrMore)} />
            <Line label="Solution / note votes" value={`${num(insights.votes?.solutions)} / ${num(insights.votes?.notes)}`} />
            <Line
              label="Open reports (solutions / notes)"
              value={`${num(insights.openReports?.solutions)} / ${num(insights.openReports?.notes)}`}
            />
          </Card>
          <Card title={`This server (${ops?.origin ?? '?'})`}>
            <Line label="Sync requests" value={num(ops?.requests)} />
            <Line
              label="Ops applied / superseded / rejected"
              value={`${num(ops?.opsApplied)} / ${num(ops?.opsSuperseded)} / ${num(ops?.opsRejected)}`}
            />
            <Line label="Section errors" value={num(ops?.sectionErrors)} />
            <Hint>Counts since this server process started; the other server has its own.</Hint>
          </Card>
        </>
      )}

      {canAudit && (
        <Card title="Recent admin actions">
          {auditError && <ErrorBox message={auditError} onRetry={() => void load()} />}
          {audit.length === 0 && !auditError && <Hint>Nothing recorded yet.</Hint>}
          {audit.map((e, i) => (
            <View key={`${e.at}-${i}`} style={{ gap: 2 }}>
              <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 13, color: e.outcome === 'ok' ? COLORS.text : '#b91c1c' }}>
                {e.tool}
                {e.action ? ` · ${e.action}` : ''} · {e.outcome}
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>
                {new Date(e.at).toLocaleString()} · {e.admin}
                {e.target ? ` · ${e.target}` : ''}
              </Text>
              {e.detail ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>{e.detail}</Text>
              ) : null}
            </View>
          ))}
          {more && <Btn label="Load more" kind="secondary" busy={loadingMore} onPress={() => void loadMore()} />}
        </Card>
      )}
    </AdminScroll>
  );
};
