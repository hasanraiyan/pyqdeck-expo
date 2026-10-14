import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { useQuery } from '@tanstack/react-query';
import { getMyContributions, type PaperContribution } from '../api';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme/colors';

const STATUS_CONFIG: Record<
  PaperContribution['status'],
  { label: string; color: string; icon: string }
> = {
  received: { label: 'Received', color: COLORS.textMuted, icon: 'clock' },
  reviewed: { label: 'Reviewed', color: '#f59e0b', icon: 'eye' },
  approved: { label: 'Approved', color: COLORS.success, icon: 'check-circle' },
  rejected: { label: 'Rejected', color: '#e53e3e', icon: 'x-circle' },
};

function ContributionCard({ item }: { item: PaperContribution }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.received;
  const date = new Date(item.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.card}>
      {/* Title row */}
      <View style={styles.cardTop}>
        <View style={styles.fileTypeBox}>
          <Feather
            name={item.fileType === 'pdf' ? 'file-text' : 'image'}
            size={16}
            color={COLORS.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.subjectText} numberOfLines={1}>
            {item.subjectName || 'Uncategorized'}
          </Text>
          <Text style={styles.metaText}>
            {item.year ? `${item.year}  ·  ` : ''}{item.files.length}{' '}
            {item.files.length === 1 ? 'file' : 'files'}  ·  {date}
          </Text>
        </View>
        {/* Status badge */}
        <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
          <Feather name={cfg.icon as any} size={11} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* File list (names only, no clickable storage URLs) */}
      {item.files.map((f, i) => (
        <View
          key={f.storageId || `${i}-${f.name}`}
          style={styles.fileRow}
        >
          <Feather
            name={f.resourceType === 'raw' || f.name.toLowerCase().endsWith('.pdf') ? 'file-text' : 'image'}
            size={13}
            color={COLORS.textMuted}
          />
          <Text style={styles.fileName} numberOfLines={1}>
            {f.name}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Feather name="upload-cloud" size={28} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No contributions yet</Text>
      <Text style={styles.emptyDesc}>
        Exam papers you upload will appear here. Help your batch by sharing question papers!
      </Text>
    </View>
  );
}

export function MyContributionsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['myContributions'],
    queryFn: getMyContributions,
    retry: 1,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Contributions</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Body */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Feather name="wifi-off" size={32} color={COLORS.textMuted} />
          <Text style={styles.errorText}>
            {(error as any)?.message || 'Could not load your contributions.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <ContributionCard item={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          ListEmptyComponent={<EmptyState />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  retryText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemi,
    color: COLORS.primary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 10,
    ...SHADOWS.subtle,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileTypeBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemi,
    color: COLORS.text,
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: FONTS.bodySemi,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.text,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
