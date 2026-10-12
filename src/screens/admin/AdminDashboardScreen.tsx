import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { adminAudit, adminInsights } from '../../api';
import { COLORS, FONTS } from '../../theme/colors';
import { userMessage } from '../../utils/netError';
import { useAdminAccess } from '../../admin/useAdminAccess';
import { can } from '../../admin/adminLogic';
import {
  AdminScroll,
  Btn,
  EmptyState,
  Fact,
  formatWhen,
  Hint,
  Loading,
  Notice,
  num,
  PageHeader,
  Pill,
  Section,
  StatTile,
  TileGrid,
  Card,
} from '../../admin/ui';

type Entry = Awaited<ReturnType<typeof adminAudit>>['entries'][number];
const PAGE = 30;

const outcomeTone = (o: Entry['outcome']) => (o === 'ok' ? 'ok' : 'danger');

const countsLine = (obj: Record<string, number> | undefined) => {
  const entries = Object.entries(obj ?? {});
  if (entries.length === 0) return 'None yet';
  return entries.map(([k, v]) => `${k}: ${num(v)}`).join('  ·  ');
};

const versionTotal = (versions: Record<string, number> | undefined) =>
  Object.values(versions ?? {}).reduce((a, b) => a + b, 0);

const pct = (part: unknown, whole: unknown) => {
  const p = Number(part);
  const w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return '-';
  return `${Math.round((p / w) * 100)}%`;
};

/** Headline numbers, sync health, and the recent admin actions. */
export const AdminDashboardScreen = () => {
  const { tools } = useAdminAccess();
  const [insights, setInsights] = useState<Record<string, any> | null>(null);
  const [audit, setAudit] = useState<Entry[]>([]);
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
      canAudit ? adminAudit({ limit: PAGE }) : Promise.resolve(null),
    ]);
    if (ins.status === 'fulfilled') setInsights(ins.value);
    else setError(userMessage(ins.reason, 'Could not load the numbers.'));
    if (aud.status === 'fulfilled' && aud.value) {
      setAudit(aud.value.entries);
      setMore(aud.value.count >= PAGE);
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
      const next = await adminAudit({ limit: PAGE, offset: audit.length });
      setAudit((cur) => [...cur, ...next.entries]);
      setMore(next.count >= PAGE);
    } catch (e) {
      setAuditError(userMessage(e, 'Could not load more.'));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <Loading label="Loading the dashboard" />;

  const a = insights?.accounts;
  const sy = insights?.sync;
  const dv = insights?.devices;
  const ops = insights?.ops;
  const traffic = insights?.traffic;
  const reports = (insights?.openReports?.solutions ?? 0) + (insights?.openReports?.notes ?? 0);

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
      <PageHeader title="Dashboard" summary="How PyQdeck is being used right now." />

      {error && (
        <Section>
          <Notice tone="danger" onRetry={() => void load()}>
            {error}
          </Notice>
        </Section>
      )}

      {insights && (
        <>
          <Section title="Accounts">
            <TileGrid>
              <StatTile label="Total accounts" value={num(a?.total)} />
              <StatTile label="Active, last 7 days" value={num(a?.active7d)} hint={`${num(a?.active30d)} in 30 days`} />
              <StatTile label="New, last 7 days" value={num(a?.created7d)} hint={`${num(a?.created30d)} in 30 days`} />
              <StatTile label="Open reports" value={num(reports)} tone={reports > 0 ? 'danger' : 'neutral'} />
            </TileGrid>
          </Section>

          <Section title="Sync">
            <Card>
              <Fact label="Accounts with synced progress" value={num(sy?.accountsWithProgress)} />
              <Fact label="Records (done)" value={`${num(sy?.progressRecords)} (${num(sy?.doneRecords)})`} />
              <Fact label="Changed, last 7 / 30 days" value={`${num(sy?.accountsChanged7d)} / ${num(sy?.accountsChanged30d)}`} />
              <Fact label="Use Jump Back In" value={num(sy?.accountsWithJumpBackIn)} />
              <Fact label="Ask AI engine choices" value={countsLine(sy?.askAiEngineChoices)} />
              <Fact label="Reading layout choices" value={countsLine(sy?.readingLayoutChoices)} />
            </Card>
          </Section>

          {traffic && (
            <>
              <Section title="Sync traffic, last 7 days">
                <TileGrid>
                  <StatTile label="Sync requests" value={num(traffic.totals?.requests)} hint="both servers" />
                  <StatTile
                    label="Answered from a shared result"
                    value={num(traffic.totals?.coalescedRequests)}
                    hint={pct(traffic.totals?.coalescedRequests, traffic.totals?.requests)}
                  />
                  <StatTile label="Rejected changes" value={num(traffic.totals?.opsRejected)} tone={traffic.totals?.opsRejected > 0 ? 'danger' : 'neutral'} />
                  <StatTile label="Nudges folded together" value={num(traffic.totals?.nudgesSuppressed)} />
                </TileGrid>
                {(traffic.perDay ?? []).length > 0 && (
                  <Card>
                    {(traffic.perDay as any[]).map((d) => (
                      <Fact key={d.day} label={d.day} value={`${num(d.requests)} requests`} />
                    ))}
                  </Card>
                )}
              </Section>

              <Section title="App versions calling">
                <Card>
                  {Object.keys(traffic.clientVersions ?? {}).length === 0 ? (
                    <Hint>No requests recorded yet.</Hint>
                  ) : (
                    Object.entries(traffic.clientVersions as Record<string, number>).map(([version, n]) => (
                      <Fact
                        key={version}
                        label={version === 'legacy' ? 'Older builds (no version)' : version}
                        value={`${num(n)} (${pct(n, versionTotal(traffic.clientVersions))})`}
                      />
                    ))
                  )}
                  <Hint>
                    Builds before 1.11 do not report a version. When this share is small, it is safe to ask people to
                    update.
                  </Hint>
                </Card>
              </Section>
            </>
          )}

          <Section title="Devices and votes">
            <TileGrid>
              <StatTile label="Registered devices" value={num(dv?.registered)} hint={`${num(dv?.linkedToAccount)} linked to an account`} />
              <StatTile label="Accounts with 2+ devices" value={num(dv?.accountsWithTwoOrMore)} />
              <StatTile label="Solution votes" value={num(insights.votes?.solutions)} />
              <StatTile label="Note votes" value={num(insights.votes?.notes)} />
            </TileGrid>
          </Section>

          <Section title={`This server (${ops?.origin ?? 'unknown'})`}>
            <Card>
              <Fact label="Sync requests" value={num(ops?.requests)} />
              <Fact label="Applied / superseded / rejected" value={`${num(ops?.opsApplied)} / ${num(ops?.opsSuperseded)} / ${num(ops?.opsRejected)}`} />
              <Fact label="Section errors" value={num(ops?.sectionErrors)} />
              <Fact label="Answered from a shared result" value={num(ops?.coalescedRequests)} />
              <Fact label="Nudges folded together" value={num(ops?.nudgesSuppressed)} />
              <Hint>Counted since this server last restarted. The other server keeps its own count.</Hint>
            </Card>
          </Section>
        </>
      )}

      {canAudit && (
        <Section title="Recent admin actions">
          {auditError && (
            <Notice tone="danger" onRetry={() => void load()}>
              {auditError}
            </Notice>
          )}
          {audit.length === 0 && !auditError ? (
            <EmptyState icon="shield" title="No admin actions yet" body="Changes you make from the admin tools appear here." />
          ) : (
            <Card>
              {audit.map((e, i) => (
                <View
                  key={`${e.at}-${i}`}
                  style={{
                    gap: 6,
                    paddingBottom: 12,
                    borderBottomWidth: i === audit.length - 1 ? 0 : 1,
                    borderBottomColor: COLORS.borderLight,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text, flexShrink: 1 }}>
                      {e.tool}
                      {e.action ? ` · ${e.action}` : ''}
                    </Text>
                    <Pill label={e.outcome === 'ok' ? 'Done' : 'Failed'} tone={outcomeTone(e.outcome)} />
                  </View>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>
                    {formatWhen(e.at)} · {e.admin}
                    {e.target ? ` · ${e.target}` : ''}
                  </Text>
                  {e.detail ? (
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>{e.detail}</Text>
                  ) : null}
                </View>
              ))}
              {more && (
                <Btn label="Load more" kind="secondary" busy={loadingMore} onPress={() => void loadMore()} />
              )}
            </Card>
          )}
        </Section>
      )}
    </AdminScroll>
  );
};
