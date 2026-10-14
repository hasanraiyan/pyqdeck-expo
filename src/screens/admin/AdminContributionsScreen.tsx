import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  adminDeleteContribution,
  adminListContributions,
  adminUpdateContributionStatus,
  type AdminContributionsResponse,
} from '../../api';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../../theme/colors';
import { userMessage } from '../../utils/netError';

type SubmissionItem = AdminContributionsResponse['submissions'][number];

const STATUS_CONFIG: Record<
  SubmissionItem['status'],
  { label: string; color: string; icon: string }
> = {
  received: { label: 'Received', color: COLORS.textMuted, icon: 'clock' },
  reviewed: { label: 'Reviewed', color: '#f59e0b', icon: 'eye' },
  approved: { label: 'Approved', color: COLORS.success, icon: 'check-circle' },
  rejected: { label: 'Rejected', color: '#e53e3e', icon: 'x-circle' },
};

export const AdminContributionsScreen = () => {
  const insets = useSafeAreaInsets();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  // Confirmation after a status change: says where the paper went and offers a jump there.
  const [moved, setMoved] = useState<{ subject: string; status: SubmissionItem['status'] } | null>(null);

  useEffect(() => {
    if (!moved) return;
    const t = setTimeout(() => setMoved(null), 5000);
    return () => clearTimeout(t);
  }, [moved]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await adminListContributions({ limit: 100, offset: 0 });
      setSubmissions(res.submissions || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(userMessage(err, 'Could not load student paper submissions.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open file URL.');
    });
  };

  const handleDelete = (item: SubmissionItem) => {
    Alert.alert(
      'Delete Submission?',
      `Delete paper submission for "${item.subjectName}"? This will permanently delete the uploaded files from cloud storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionLoadingId(item._id);
            try {
              await adminDeleteContribution(item._id);
              setSubmissions((prev) => prev.filter((s) => s._id !== item._id));
              setTotal((prev) => Math.max(0, prev - 1));
            } catch (err) {
              Alert.alert('Error', userMessage(err, 'Could not delete submission.'));
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleUpdateStatus = (
    item: SubmissionItem,
    newStatus: 'received' | 'reviewed' | 'approved' | 'rejected'
  ) => {
    setActionLoadingId(item._id);
    adminUpdateContributionStatus(item._id, newStatus)
      .then(() => {
        setSubmissions((prev) =>
          prev.map((s) => (s._id === item._id ? { ...s, status: newStatus } : s))
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMoved({ subject: item.subjectName || 'Paper', status: newStatus });
      })
      .catch((err) => {
        Alert.alert('Error', userMessage(err, 'Could not update status.'));
      })
      .finally(() => {
        setActionLoadingId(null);
      });
  };

  const counts = submissions.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
    {},
  );

  const filtered = submissions.filter((s) => {
    if (filterStatus === 'all') return true;
    return s.status === filterStatus;
  });

  const renderItem = ({ item }: { item: SubmissionItem }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.received;
    const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const isBusy = actionLoadingId === item._id;

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.typeIconBox}>
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
              <Text style={styles.metaSub}>
                {item.year ? `${item.year}  ·  ` : ''}
                {item.isAnonymous ? 'Guest' : item.contributorEmail || 'Student'}
                {'  ·  '}
                {dateStr}
              </Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
            <Feather name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Attached Files (with direct download/view link for Admin) */}
        <View style={styles.fileSection}>
          <Text style={styles.filesHeader}>
            Attached ({item.files.length} {item.files.length === 1 ? 'file' : 'files'}):
          </Text>
          {item.files.map((file, idx) => (
            <TouchableOpacity
              key={file.storageId || `${idx}-${file.name}`}
              style={styles.fileRow}
              activeOpacity={0.7}
              onPress={() => handleOpenUrl(file.url)}
            >
              {file.resourceType === 'raw' || file.name.toLowerCase().endsWith('.pdf') ? (
                <View style={styles.fileThumbIcon}>
                  <Feather name="file-text" size={16} color="#ffffff" />
                </View>
              ) : (
                <Image source={{ uri: file.url }} style={styles.fileThumb} contentFit="cover" />
              )}
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              {file.size > 0 && (
                <Text style={styles.fileSizeText}>
                  {file.size < 1024 * 1024
                    ? `${Math.round(file.size / 1024)} KB`
                    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                </Text>
              )}
              <Feather name="external-link" size={13} color={COLORS.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Moderation Actions */}
        <View style={styles.actionsRow}>
          {item.status === 'approved' || item.status === 'rejected' ? (
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={() => handleUpdateStatus(item, 'received')}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              <Feather name="rotate-ccw" size={14} color={COLORS.textMuted} />
              <Text style={styles.undoBtnText}>Move back to Received</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.decisionGroup}>
              <TouchableOpacity
                style={[styles.decisionBtn, styles.approveBtn, isBusy && styles.btnDisabled]}
                onPress={() => handleUpdateStatus(item, 'approved')}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Feather name="check" size={15} color="#ffffff" />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.decisionBtn, styles.rejectBtn, isBusy && styles.btnDisabled]}
                onPress={() => handleUpdateStatus(item, 'rejected')}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Feather name="x" size={15} color="#e53e3e" />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              {item.status === 'received' && (
                <TouchableOpacity
                  style={styles.reviewedBtn}
                  onPress={() => handleUpdateStatus(item, 'reviewed')}
                  disabled={isBusy}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.reviewedBtnText}>Mark reviewed</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            disabled={isBusy}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete submission"
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#e53e3e" />
            ) : (
              <Feather name="trash-2" size={16} color="#e53e3e" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Filters row */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {(['all', 'received', 'reviewed', 'approved', 'rejected'] as const).map((st) => {
            const selected = filterStatus === st;
            const n = st === 'all' ? total : counts[st] ?? 0;
            return (
              <TouchableOpacity
                key={st}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                onPress={() => setFilterStatus(st)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                  {st === 'all' ? 'All' : STATUS_CONFIG[st].label}
                </Text>
                <View style={[styles.countBadge, selected && styles.countBadgeActive]}>
                  <Text style={[styles.countText, selected && styles.countTextActive]}>{n}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {moved && (
        <View style={styles.movedBanner}>
          <Feather name={STATUS_CONFIG[moved.status].icon as any} size={16} color={STATUS_CONFIG[moved.status].color} />
          <Text style={styles.movedText} numberOfLines={2}>
            {moved.subject} marked {STATUS_CONFIG[moved.status].label.toLowerCase()}
          </Text>
          {filterStatus !== moved.status && (
            <TouchableOpacity
              onPress={() => {
                setFilterStatus(moved.status);
                setMoved(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.movedLink}>View</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main content */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={32} color={COLORS.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No submissions found</Text>
              <Text style={styles.emptySub}>
                {filterStatus === 'all'
                  ? 'No students have contributed question papers yet.'
                  : `No contributions with status "${filterStatus}".`}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterWrap: {
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    flexGrow: 0,
  },
  filterBar: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  countBadge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  countText: {
    fontSize: 11,
    fontFamily: FONTS.bodyBold,
    color: COLORS.textMuted,
  },
  countTextActive: {
    color: '#ffffff',
  },
  movedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    ...SHADOWS.subtle,
  },
  movedText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.bodySemi,
    color: COLORS.text,
  },
  movedLink: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: COLORS.primary,
  },
  fileThumb: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardSecondary,
  },
  fileThumbIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  decisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  approveBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: '#ffffff',
  },
  rejectBtn: {
    backgroundColor: COLORS.card,
    borderColor: '#e53e3e',
  },
  rejectBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bodyBold,
    color: '#e53e3e',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  reviewedBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  reviewedBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    flex: 1,
  },
  undoBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 12,
    ...SHADOWS.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectText: {
    fontSize: 14,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
  },
  metaSub: {
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
  fileSection: {
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  filesHeader: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.text,
  },
  fileSizeText: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: COLORS.textSubtle,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  statusChangeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: '#fff5f5',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  retryBtnText: {
    fontSize: 13,
    fontFamily: FONTS.bodySemi,
    color: COLORS.primary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
