import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
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
import { SearchInput } from '../../admin/ui';

type SubmissionItem = AdminContributionsResponse['submissions'][number];

const STATUS_CONFIG: Record<
  SubmissionItem['status'],
  { label: string; color: string; bg: string; icon: string }
> = {
  received: { label: 'Received', color: '#b45309', bg: '#fef3c7', icon: 'clock' },
  reviewed: { label: 'Reviewed', color: '#d97706', bg: '#fffbeb', icon: 'eye' },
  approved: { label: 'Approved', color: '#15803d', bg: '#ecfdf5', icon: 'check-circle' },
  rejected: { label: 'Rejected', color: '#b91c1c', bg: '#fef2f2', icon: 'x-circle' },
};

export const AdminContributionsScreen = () => {
  const insets = useSafeAreaInsets();
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ subject: string; status: SubmissionItem['status'] } | null>(null);

  useEffect(() => {
    if (!moved) return;
    const t = setTimeout(() => setMoved(null), 5000);
    return () => clearTimeout(t);
  }, [moved]);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await adminListContributions({ limit: 150, offset: 0 });
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Submission?',
      `Delete paper submission for "${item.subjectName || 'Uncategorized'}"? This will permanently delete the uploaded files from cloud storage.`,
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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    {}
  );

  const filtered = submissions.filter((s) => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchSubject = (s.subjectName || '').toLowerCase().includes(q);
    const matchEmail = (s.contributorEmail || '').toLowerCase().includes(q);
    const matchYear = String(s.year || '').includes(q);
    const matchFiles = s.files?.some((f) => (f.name || '').toLowerCase().includes(q));
    return matchSubject || matchEmail || matchYear || matchFiles;
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
                size={17}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.subjectText} numberOfLines={1}>
                  {item.subjectName || 'Uncategorized Paper'}
                </Text>
                {item.year ? (
                  <View style={styles.yearBadge}>
                    <Text style={styles.yearText}>{item.year}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.contributorRow}>
                <Feather
                  name={item.isAnonymous ? 'user-x' : 'user-check'}
                  size={12}
                  color={item.isAnonymous ? COLORS.textSubtle : '#059669'}
                />
                <Text style={styles.contributorText} numberOfLines={1}>
                  {item.isAnonymous ? 'Guest Student' : item.contributorEmail || 'Registered'}
                </Text>
                <Text style={styles.dotSeparator}>·</Text>
                <Text style={styles.dateText}>{dateStr}</Text>
              </View>
            </View>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { borderColor: cfg.color, backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Attached Files List & Previews */}
        <View style={styles.fileSection}>
          <Text style={styles.filesHeader}>
            Attached ({item.files.length} {item.files.length === 1 ? 'file' : 'files'}):
          </Text>
          <View style={styles.filesGrid}>
            {item.files.map((file, idx) => {
              const isPdf = file.resourceType === 'raw' || file.name.toLowerCase().endsWith('.pdf');
              return (
                <View key={file.storageId || `${idx}-${file.name}`} style={styles.fileRow}>
                  {isPdf ? (
                    <TouchableOpacity
                      style={styles.fileThumbIcon}
                      onPress={() => handleOpenUrl(file.url)}
                      activeOpacity={0.7}
                    >
                      <Feather name="file-text" size={16} color="#ffffff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setPreviewImageUrl(file.url)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: file.url }} style={styles.fileThumb} contentFit="cover" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.fileInfoText}>
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
                  </View>
                  <TouchableOpacity
                    onPress={() => handleOpenUrl(file.url)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.openExternalBtn}
                    accessibilityLabel="Open file in browser"
                  >
                    <Feather name="external-link" size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Moderation Actions Bar */}
        <View style={styles.actionsRow}>
          {item.status === 'approved' || item.status === 'rejected' ? (
            <TouchableOpacity
              style={styles.undoBtn}
              onPress={() => handleUpdateStatus(item, 'received')}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              <Feather name="rotate-ccw" size={14} color={COLORS.textMuted} />
              <Text style={styles.undoBtnText}>Reset to Received</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.decisionGroup}>
              <TouchableOpacity
                style={[styles.decisionBtn, styles.approveBtn, isBusy && styles.btnDisabled]}
                onPress={() => handleUpdateStatus(item, 'approved')}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Feather name="check" size={14} color="#ffffff" />
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.decisionBtn, styles.rejectBtn, isBusy && styles.btnDisabled]}
                onPress={() => handleUpdateStatus(item, 'rejected')}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <Feather name="x" size={14} color="#b91c1c" />
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
              {item.status === 'received' && (
                <TouchableOpacity
                  style={styles.reviewedBtn}
                  onPress={() => handleUpdateStatus(item, 'reviewed')}
                  disabled={isBusy}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.reviewedBtnText}>Mark Reviewed</Text>
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
              <ActivityIndicator size="small" color="#b91c1c" />
            ) : (
              <Feather name="trash-2" size={15} color="#b91c1c" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* Top Search Bar */}
      <View style={styles.searchHeader}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search subjects, years, contributors..."
          onClear={() => setSearchQuery('')}
        />
      </View>

      {/* Filter Tabs */}
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
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilterStatus(st);
                }}
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

      {/* Moved Confirmation Toast */}
      {moved && (
        <View style={styles.movedBanner}>
          <Feather
            name={STATUS_CONFIG[moved.status].icon as any}
            size={16}
            color={STATUS_CONFIG[moved.status].color}
          />
          <Text style={styles.movedText} numberOfLines={1}>
            "{moved.subject}" marked {STATUS_CONFIG[moved.status].label.toLowerCase()}
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

      {/* Results Counter Bar */}
      {!loading && !error && (
        <View style={styles.counterBar}>
          <Text style={styles.counterText}>
            Showing {filtered.length} of {total} {total === 1 ? 'submission' : 'submissions'}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </Text>
        </View>
      )}

      {/* Main Content List */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Fetching student paper contributions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Feather name="alert-circle" size={36} color={COLORS.primary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Feather name="inbox" size={32} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Submissions Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? `No papers matching "${searchQuery}". Try searching for another subject or year.`
                  : filterStatus === 'all'
                  ? 'No students have contributed question papers yet.'
                  : `No paper submissions currently in "${filterStatus}" status.`}
              </Text>
              {searchQuery ? (
                <TouchableOpacity style={styles.clearSearchBtn} onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearSearchBtnText}>Clear Search</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      {/* In-App Image Preview Modal */}
      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.previewBackdrop}>
          <View style={[styles.previewHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.previewCloseBtn}
              onPress={() => setPreviewImageUrl(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={22} color="#ffffff" />
            </TouchableOpacity>
            {previewImageUrl && (
              <TouchableOpacity
                style={styles.previewExternalBtn}
                onPress={() => handleOpenUrl(previewImageUrl)}
              >
                <Feather name="external-link" size={16} color="#ffffff" />
                <Text style={styles.previewExternalText}>Open Original</Text>
              </TouchableOpacity>
            )}
          </View>
          {previewImageUrl && (
            <View style={styles.previewImageContainer}>
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.previewImage}
                contentFit="contain"
              />
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: COLORS.background,
  },
  filterWrap: {
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  filterBar: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
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
    backgroundColor: COLORS.card,
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
  countBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  countText: {
    fontSize: 10,
    fontFamily: FONTS.bodyBold,
    color: COLORS.textMuted,
  },
  countTextActive: {
    color: '#ffffff',
  },
  counterBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  counterText: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: COLORS.textSubtle,
  },
  movedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    gap: 12,
    ...SHADOWS.subtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    width: 38,
    height: 38,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  subjectText: {
    fontSize: 15,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
    flexShrink: 1,
  },
  yearBadge: {
    backgroundColor: COLORS.cardSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  yearText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  contributorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textMuted,
    maxWidth: 150,
  },
  dotSeparator: {
    color: COLORS.textSubtle,
    fontSize: 11,
  },
  dateText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textSubtle,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily: FONTS.bodyBold,
  },
  fileSection: {
    gap: 6,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: 10,
  },
  filesHeader: {
    fontSize: 11,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filesGrid: {
    gap: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
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
  fileInfoText: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 12,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.text,
  },
  fileSizeText: {
    fontSize: 10,
    fontFamily: FONTS.body,
    color: COLORS.textSubtle,
  },
  openExternalBtn: {
    padding: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  decisionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  decisionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  approveBtn: {
    backgroundColor: '#15803d',
    borderColor: '#15803d',
  },
  approveBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: '#ffffff',
  },
  rejectBtn: {
    backgroundColor: '#fff5f5',
    borderColor: '#fecaca',
  },
  rejectBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: '#b91c1c',
  },
  reviewedBtn: {
    paddingHorizontal: 6,
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
    paddingVertical: 6,
  },
  undoBtnText: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
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
    marginTop: 4,
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
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  clearSearchBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearSearchBtnText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: COLORS.primary,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  previewExternalText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: '#ffffff',
  },
  previewImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});
