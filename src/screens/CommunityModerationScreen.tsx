import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import type { Comment, ModerationEvent, Post, ReportGroup, ReportReason } from '@pyqdeck/community-sdk';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ScreenContainer } from '../components/ScreenContainer';
import { ActionSheet, type SheetOption } from '../components/community/moderation/ActionSheet';
import { CardButton, Chip, ModerationCard, type ChipTone } from '../components/community/moderation/ModerationCard';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { shortAgo } from '../community/mappers';
import { moderateComment, moderatePost, REMOVAL_REASONS, resolveReports, suspendMember } from '../community/moderationActions';
import { eventsQuery, heldQuery, reportsQuery, useCommunityRole } from '../community/moderationQueries';

type Tab = 'held' | 'reports' | 'history';
type HeldItem = { kind: 'post'; post: Post } | { kind: 'comment'; comment: Comment };
type HistoryFilter = 'all' | 'review' | 'reject' | 'allow';

const holdChip = (reason?: string | null, hasPendingEdit?: boolean, status?: string): { label: string; tone: ChipTone } => {
  if (status === 'published' && hasPendingEdit) return { label: 'Edit waiting', tone: 'info' };
  if (reason === 'reports') return { label: 'Hidden by reports', tone: 'danger' };
  return { label: 'Held by AI check', tone: 'warn' };
};

const ACTION_LABEL: Record<ModerationEvent['action'], { label: string; tone: ChipTone; icon: keyof typeof Feather.glyphMap }> = {
  allow: { label: 'Allowed', tone: 'ok', icon: 'check-circle' },
  review: { label: 'Held', tone: 'warn', icon: 'alert-triangle' },
  reject: { label: 'Refused', tone: 'danger', icon: 'x-circle' },
};

const SOURCE_LABEL: Record<string, string> = { media: 'Image', post: 'Post text', comment: 'Comment', profile: 'Profile text' };

export const CommunityModerationScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const role = useCommunityRole();

  const [tab, setTab] = useState<Tab>('held');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [sheet, setSheet] = useState<{ title?: string; options: SheetOption[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Tapping a thumbnail in the history opens it full size in the app's image viewer.
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);

  const held = useQuery(heldQuery());
  const reports = useQuery(reportsQuery());
  const events = useInfiniteQuery(eventsQuery(historyFilter === 'all' ? {} : { action: historyFilter }));

  const heldItems = useMemo<HeldItem[]>(() => {
    const items: HeldItem[] = [
      ...(held.data?.posts ?? []).map((post) => ({ kind: 'post' as const, post })),
      ...(held.data?.comments ?? []).map((comment) => ({ kind: 'comment' as const, comment })),
    ];
    const when = (i: HeldItem) => Date.parse(i.kind === 'post' ? i.post.createdAt : i.comment.createdAt);
    return items.sort((a, b) => when(b) - when(a));
  }, [held.data]);
  const eventItems = events.data?.pages.flatMap((p) => p.items) ?? [];

  const run = async (id: string, work: () => Promise<boolean>) => {
    setBusyId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await work();
    } finally {
      setBusyId(null);
    }
  };

  /** A sheet that asks "why?", then calls back with the chosen reason. */
  const askReason = (title: string, onPick: (reason: ReportReason, label: string) => void) =>
    setSheet({
      title,
      options: REMOVAL_REASONS.map((r) => ({
        icon: 'flag' as const,
        label: r.label,
        subtitle: r.hint,
        onPress: () => onPick(r.key, r.label),
      })),
    });

  const confirmSuspend = (username: string) =>
    askReason(`Suspend @${username}: why?`, (_key, label) =>
      Alert.alert(`Suspend @${username}?`, `They will not be able to post, comment or react until you lift it. Reason: ${label}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Suspend', style: 'destructive', onPress: () => void suspendMember(username, label) },
      ])
    );

  const openPost = (postId: string) => navigation.navigate('CommunityPostDetail', { postId });

  // ---- held ----

  const renderHeld = ({ item }: { item: HeldItem }) => {
    if (item.kind === 'post') {
      const p = item.post;
      const chip = holdChip(p.heldReason, p.hasPendingEdit, p.status);
      const editing = p.status === 'published' && p.hasPendingEdit;
      return (
        <ModerationCard
          name={p.author.displayName}
          subtitle={p.author.username ? `@${p.author.username} · Post` : 'Post'}
          avatarUrl={p.author.avatarUrl || undefined}
          time={shortAgo(p.createdAt)}
          chips={[chip]}
          body={p.body}
          images={p.media.map((m) => m.url)}
          onPressBody={() => openPost(p.id)}
        >
          <CardButton
            tone="primary"
            label={editing ? 'Approve edit' : 'Approve'}
            disabled={busyId === p.id}
            onPress={() => run(p.id, () => moderatePost(p.id, 'approve'))}
          />
          {editing ? (
            <CardButton label="Reject edit" disabled={busyId === p.id} onPress={() => run(p.id, () => moderatePost(p.id, 'reject_edit'))} />
          ) : null}
          <CardButton
            tone="danger"
            label="Remove"
            disabled={busyId === p.id}
            onPress={() => askReason('Remove this post: why?', (key) => void run(p.id, () => moderatePost(p.id, 'remove', key)))}
          />
          <CardButton
            label="More"
            onPress={() =>
              setSheet({
                options: [
                  { icon: 'external-link', label: 'Open post', onPress: () => openPost(p.id) },
                  ...(p.author.username
                    ? [{ icon: 'user-x' as const, label: `Suspend @${p.author.username}`, destructive: true, onPress: () => confirmSuspend(p.author.username!) }]
                    : []),
                ],
              })
            }
          />
        </ModerationCard>
      );
    }

    const c = item.comment;
    const chip = holdChip(c.heldReason, c.hasPendingEdit, c.status);
    const editing = c.status === 'published' && c.hasPendingEdit;
    return (
      <ModerationCard
        name={c.author.displayName}
        subtitle={c.author.username ? `@${c.author.username} · Comment` : 'Comment'}
        avatarUrl={c.author.avatarUrl || undefined}
        time={shortAgo(c.createdAt)}
        chips={[chip]}
        body={c.body}
        onPressBody={() => openPost(c.postId)}
      >
        <CardButton
          tone="primary"
          label={editing ? 'Approve edit' : 'Approve'}
          disabled={busyId === c.id}
          onPress={() => run(c.id, () => moderateComment(c.id, 'approve'))}
        />
        {editing ? (
          <CardButton label="Reject edit" disabled={busyId === c.id} onPress={() => run(c.id, () => moderateComment(c.id, 'reject_edit'))} />
        ) : null}
        <CardButton
          tone="danger"
          label="Remove"
          disabled={busyId === c.id}
          onPress={() => askReason('Remove this comment: why?', (key) => void run(c.id, () => moderateComment(c.id, 'remove', key)))}
        />
        <CardButton
          label="More"
          onPress={() =>
            setSheet({
              options: [
                { icon: 'external-link', label: 'Open the post', onPress: () => openPost(c.postId) },
                ...(c.author.username
                  ? [{ icon: 'user-x' as const, label: `Suspend @${c.author.username}`, destructive: true, onPress: () => confirmSuspend(c.author.username!) }]
                  : []),
              ],
            })
          }
        />
      </ModerationCard>
    );
  };

  // ---- reports ----

  const renderReport = ({ item: g }: { item: ReportGroup }) => {
    const key = `${g.targetType}:${g.targetId}`;
    const preview = g.preview;
    const canRemove = g.targetType !== 'member';
    const username = g.targetType === 'member' ? preview?.authorUsername : preview?.authorUsername;
    const notes = g.notes.length ? `\n\nReporters wrote: ${g.notes.map((n) => `"${n}"`).join(', ')}` : '';
    return (
      <ModerationCard
        name={preview?.title ?? `Reported ${g.targetType}`}
        subtitle={`${g.count} report${g.count === 1 ? '' : 's'} · ${g.targetType}`}
        time={shortAgo(g.firstReportedAt)}
        chips={[
          { label: `${g.count} × reported`, tone: g.count >= 3 ? 'danger' : 'warn' },
          ...g.reasons.map((r) => ({ label: r, tone: 'info' as const })),
          ...(preview?.status && preview.status !== 'published' ? [{ label: preview.status, tone: 'warn' as const }] : []),
        ]}
        body={preview ? `${preview.snippet ?? ''}${notes}`.trim() || undefined : undefined}
        onPressBody={preview?.postId ? () => openPost(preview.postId!) : undefined}
      >
        {canRemove ? (
          <CardButton
            tone="danger"
            label={g.targetType === 'link' ? 'Block link' : 'Remove content'}
            disabled={busyId === key}
            onPress={() => run(key, () => resolveReports(g, 'actioned', true))}
          />
        ) : null}
        <CardButton label="Dismiss" disabled={busyId === key} onPress={() => run(key, () => resolveReports(g, 'dismissed'))} />
        {!canRemove ? <CardButton label="Mark handled" disabled={busyId === key} onPress={() => run(key, () => resolveReports(g, 'actioned'))} /> : null}
        <CardButton
          label="More"
          onPress={() =>
            setSheet({
              options: [
                ...(preview?.postId ? [{ icon: 'external-link' as const, label: 'Open post', onPress: () => openPost(preview.postId!) }] : []),
                ...(username
                  ? [{ icon: 'user-x' as const, label: `Suspend @${username}`, destructive: true, onPress: () => confirmSuspend(username) }]
                  : []),
                { icon: 'check' as const, label: 'Mark handled, keep content', onPress: () => void run(key, () => resolveReports(g, 'actioned')) },
              ],
            })
          }
        />
      </ModerationCard>
    );
  };

  // ---- history ----

  const renderEvent = ({ item: e }: { item: ModerationEvent }) => {
    const a = ACTION_LABEL[e.action];
    // Every score the checker gave, highest first. The categories it flagged are marked.
    const allScores = Object.entries(e.scores ?? {}).sort((x, y) => y[1] - x[1]);
    return (
      <View style={styles.eventRow}>
        <Feather name={a.icon} size={20} color={a.tone === 'ok' ? '#16a34a' : a.tone === 'warn' ? '#d97706' : '#dc2626'} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.eventHead}>
            <Text style={styles.eventTitle}>
              {SOURCE_LABEL[e.source] ?? e.source} · {a.label}
            </Text>
            <Text style={styles.eventTime}>{shortAgo(e.createdAt)}</Text>
          </View>
          <View style={styles.chipRow}>
            {e.escalate ? <Chip label="Child safety" tone="danger" /> : null}
            {e.degraded ? <Chip label="Checker was down" tone="warn" /> : null}
            {e.provider === 'profanity-filter' ? <Chip label="Word filter" tone="info" /> : null}
            {(e.categories ?? []).map((c) => (
              <Chip key={c} label={c} tone={a.tone} />
            ))}
          </View>
          {e.text ? (
            <Text style={styles.eventText} numberOfLines={6} selectable>
              {e.text}
            </Text>
          ) : null}
          {e.imageUrls && e.imageUrls.length > 0 ? (
            <>
              <View style={styles.eventImages}>
                {e.imageUrls.slice(0, 4).map((uri, i) => (
                  <TouchableOpacity
                    key={uri}
                    activeOpacity={0.8}
                    onPress={() => setViewer({ images: e.imageUrls ?? [], index: i })}
                    accessibilityRole="imagebutton"
                    accessibilityLabel="View image full size"
                  >
                    <Image source={{ uri }} style={styles.eventThumb} contentFit="cover" />
                  </TouchableOpacity>
                ))}
              </View>
              {e.action === 'reject' ? (
                <Text style={styles.eventNote}>Refused image: kept for 7 days for review, then deleted.</Text>
              ) : null}
            </>
          ) : null}
          {allScores.length > 0 ? (
            <View style={styles.scoreTable}>
              {allScores.map(([k, v]) => {
                const flagged = (e.categories ?? []).includes(k);
                return (
                  <View key={k} style={styles.scoreRow}>
                    <Text style={[styles.eventScores, flagged && styles.scoreFlagged]}>{k}</Text>
                    <Text style={[styles.eventScores, flagged && styles.scoreFlagged]}>
                      {v < 0.001 ? '<0.001' : v.toFixed(3)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {e.sourceId ? (
            <Text style={styles.eventId} selectable>
              id {e.sourceId}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  // ---- shell ----

  if (role === 'member') {
    return (
      <View style={styles.center}>
        <Feather name="lock" size={34} color={COLORS.textMuted} />
        <Text style={styles.centerTitle}>Moderators only</Text>
        <Text style={styles.centerBody}>This area is for community moderators and admins.</Text>
      </View>
    );
  }

  const counts = { held: heldItems.length, reports: reports.data?.length ?? 0 };
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'held', label: `Held${counts.held ? ` (${counts.held})` : ''}` },
    { key: 'reports', label: `Reports${counts.reports ? ` (${counts.reports})` : ''}` },
    { key: 'history', label: 'History' },
  ];

  const emptyState = (icon: keyof typeof Feather.glyphMap, title: string, body: string) => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={26} color={COLORS.textMuted} />
      </View>
      <Text style={styles.centerTitle}>{title}</Text>
      <Text style={styles.centerBody}>{body}</Text>
    </View>
  );

  const loading = (q: { isPending: boolean }) =>
    q.isPending ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> : null;

  const listProps = {
    contentContainerStyle: [styles.list, { paddingBottom: insets.bottom + 32 }],
    ItemSeparatorComponent: () => <View style={{ height: 10 }} />,
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabsRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setTab(t.key);
            }}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.roleBadge}>
          <Feather name="shield" size={12} color={COLORS.primary} />
          <Text style={styles.roleText}>{role === 'admin' ? 'Admin' : 'Moderator'}</Text>
        </View>
      </View>

      <ScreenContainer variant="read" gutter={false}>
        {tab === 'held' ? (
          <FlatList
            {...listProps}
            data={heldItems}
            keyExtractor={(i) => (i.kind === 'post' ? `p-${i.post.id}` : `c-${i.comment.id}`)}
            renderItem={renderHeld}
            refreshControl={<RefreshControl refreshing={held.isRefetching} onRefresh={() => void held.refetch()} tintColor={COLORS.primary} />}
            ListHeaderComponent={loading(held)}
            ListEmptyComponent={
              held.isPending
                ? null
                : emptyState('check-circle', 'Nothing is waiting', 'Posts and comments held by the AI check, hidden by reports, or edited will appear here.')
            }
          />
        ) : null}

        {tab === 'reports' ? (
          <FlatList
            {...listProps}
            data={reports.data ?? []}
            keyExtractor={(g) => `${g.targetType}:${g.targetId}`}
            renderItem={renderReport}
            refreshControl={<RefreshControl refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()} tintColor={COLORS.primary} />}
            ListHeaderComponent={loading(reports)}
            ListEmptyComponent={
              reports.isPending ? null : emptyState('flag', 'No open reports', 'When students report something, it shows up here, worst first.')
            }
          />
        ) : null}

        {tab === 'history' ? (
          <FlatList
            {...listProps}
            data={eventItems}
            keyExtractor={(e) => e._id}
            renderItem={renderEvent}
            onEndReachedThreshold={0.5}
            onEndReached={() => events.hasNextPage && !events.isFetchingNextPage && void events.fetchNextPage()}
            refreshControl={<RefreshControl refreshing={events.isRefetching && !events.isFetchingNextPage} onRefresh={() => void events.refetch()} tintColor={COLORS.primary} />}
            ListHeaderComponent={
              <View>
                <View style={styles.filterRow}>
                  {(
                    [
                      ['all', 'All'],
                      ['review', 'Held'],
                      ['reject', 'Refused'],
                      ['allow', 'Allowed'],
                    ] as const
                  ).map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setHistoryFilter(key)}
                      style={[styles.filterChip, historyFilter === key && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, historyFilter === key && styles.filterChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {loading(events)}
              </View>
            }
            ListFooterComponent={events.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null}
            ListEmptyComponent={
              events.isPending ? null : emptyState('clock', 'No checks yet', 'Every check of a post, comment, image or profile is listed here with the result.')
            }
          />
        ) : null}
      </ScreenContainer>

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        options={sheet?.options ?? []}
        onClose={() => setSheet(null)}
      />
      <ImageViewerModal
        visible={!!viewer}
        images={(viewer?.images ?? []).map((src) => ({ src }))}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.textMuted },
  tabTextActive: { fontFamily: FONTS.bodySemi, color: '#ffffff' },
  roleBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 },
  roleText: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.primary },
  list: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.background },
  centerTitle: { fontFamily: FONTS.displayBold, fontSize: 17, color: COLORS.text, marginTop: 10, textAlign: 'center' },
  centerBody: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: '#f3f4f6' },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
  filterChipTextActive: { fontFamily: FONTS.bodySemi, color: '#ffffff' },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  eventHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  eventTime: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSubtle },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  eventText: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: COLORS.text,
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.md,
    padding: 8,
  },
  eventNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },
  eventImages: { flexDirection: 'row', gap: 6 },
  eventThumb: { width: 72, height: 72, borderRadius: RADIUS.md, backgroundColor: '#f3f4f6' },
  eventScores: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  scoreTable: { gap: 1, marginTop: 2 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreFlagged: { color: '#dc2626', fontFamily: FONTS.bodySemi },
  eventId: { fontFamily: FONTS.mono, fontSize: 10.5, color: COLORS.textSubtle },
});
