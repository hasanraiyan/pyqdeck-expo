import React, { useMemo, useState, useCallback } from 'react';
import { logEvent } from '../utils/analytics';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { allSubjectsQuery } from '../api/queries';
import { prefetchSubject } from '../api/prefetch';
import { SubjectSummary, Semester } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';
import { AdBanner } from '../components/AdBanner';
import { WaveLoader } from '../components/WaveLoader';
import { getGridColumns } from '../theme/layout';
import { useResponsive } from '../utils/responsive';

export const AllSubjectsScreen = () => {
  const navigation = useNavigation<any>();
  const { width, wideMaxWidth, hPadding } = useResponsive();

  const GAP = 12;
  // Measured, not window-derived - useWindowDimensions() on web includes the
  // scrollbar, and with a sidebar the window is wider than the content box.
  const [listWidth, setListWidth] = useState(0);
  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => setListWidth(e.nativeEvent.layout.width),
    []
  );
  const trackWidth = listWidth || width;
  // A phone keeps the dense full-bleed rows; wider content gets a card grid so
  // a name and its count stop sitting at opposite ends of an empty band.
  const columns = getGridColumns(
    Math.min(trackWidth, wideMaxWidth + hPadding * 2) - hPadding * 2,
    { minCardWidth: 260, gap: GAP, maxColumns: 3 }
  );
  const isGrid = columns > 1;
  const frameMaxWidth = wideMaxWidth + (isGrid ? hPadding * 2 : 0);
  const contentWidth =
    Math.min(trackWidth, frameMaxWidth) - (isGrid ? hPadding * 2 : 0);
  const cardWidth = isGrid ? (contentWidth - GAP * (columns - 1)) / columns : undefined;

  const [query, setQuery] = useState('');
  // What the list is currently filtered by; only changes on submit, so typing
  // in the box never fires a request.
  const [appliedQuery, setAppliedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const listQ = useInfiniteQuery({
    ...allSubjectsQuery(appliedQuery),
    // Keep the previous list visible while a new search loads.
    placeholderData: keepPreviousData,
  });
  const subjects = useMemo(
    () => listQ.data?.pages.flatMap((p) => p.subjects || []) ?? [],
    [listQ.data]
  );
  const total = listQ.data?.pages[0]?.total ?? 0;
  const loading = listQ.isPending;
  const loadingMore = listQ.isFetchNextPageError ? false : listQ.isFetchingNextPage;

  const handleSearch = () => setAppliedQuery(query.trim());

  const handleEndReached = () => {
    if (listQ.hasNextPage && !listQ.isFetchingNextPage && !listQ.isFetching) {
      void listQ.fetchNextPage();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await listQ.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const renderSubjectCard = useCallback(
    ({ item }: { item: SubjectSummary & { semester: Semester } }) => {
      const isComingSoon = item.questionCount === 0;
      return (
        <TouchableOpacity
          style={[
            styles.card,
            isGrid && [styles.cardGrid, { width: cardWidth }],
            isComingSoon && styles.cardComingSoon,
          ]}
          activeOpacity={isComingSoon ? 1 : 0.7}
          disabled={isComingSoon}
          onPress={() => {
            prefetchSubject(item.id);
            logEvent('select_subject', { subject_id: String(item.id), subject_name: String(item.name) });
            navigation.navigate('SubjectDetail', {
              semesterId: item.semester?.id,
              subjectId: item.id,
              subjectName: item.name,
              subjectCode: item.code,
            });
          }}
        >
          <View style={styles.cardLeft}>
            <View style={styles.codeRow}>
              {item.code ? <Badge label={item.code} variant="secondary" /> : null}
              <Badge label={`Sem ${item.semester?.number || ''}`} variant="outline" />
              {isComingSoon && (
                <View style={styles.cardSoonTag}>
                  <Text style={styles.cardSoonTagText}>SOON</Text>
                </View>
              )}
            </View>
            <Text style={[styles.subjectName, isComingSoon && styles.subjectNameSoon]}>
              {item.name}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.questionCount}>
              {isComingSoon ? 'Coming Soon' : `${item.questionCount}q`}
            </Text>
            {!isComingSoon && (
              <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [navigation, isGrid, cardWidth]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View
          style={{
            width: '100%',
            maxWidth: wideMaxWidth + hPadding * 2,
            paddingHorizontal: hPadding,
            alignSelf: 'center',
          }}
        >
          <Text style={styles.badgeText}>ALL SUBJECTS CATALOG</Text>
          <Text style={styles.title}>Browse All Subjects</Text>
          <Text style={styles.subtitle}>
            {total} subject{total === 1 ? '' : 's'} across all 8 semesters.
          </Text>

          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              placeholder="Filter by subject name or code..."
              placeholderTextColor={COLORS.textSubtle}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (!text) setAppliedQuery('');
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
        </View>
      </View>

      <View style={styles.content} onLayout={onContentLayout}>
        {loading && !refreshing ? (
          <View
            style={[
              { padding: 16, width: '100%', maxWidth: frameMaxWidth, alignSelf: 'center' },
              // Match the loaded card grid so the page doesn't reflow when data lands.
              isGrid && { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: hPadding },
            ]}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View
                key={i}
                style={[styles.skeletonCard, isGrid && { width: cardWidth, marginBottom: 0 }]}
              >
                <Skeleton width="40%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="70%" height={14} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={subjects}
            // FlatList caches layout per column count, so it must remount when
            // that changes or a rotation leaves the old arrangement behind.
            key={columns}
            numColumns={columns}
            columnWrapperStyle={isGrid ? { gap: GAP } : undefined}
            keyExtractor={(item) => item.id}
            renderItem={renderSubjectCard}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{
              paddingBottom: 24,
              paddingTop: isGrid ? GAP : 0,
              paddingHorizontal: isGrid ? hPadding : 0,
              maxWidth: frameMaxWidth,
              width: '100%',
              alignSelf: 'center',
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No subjects found.</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreFooter}>
                  <WaveLoader color={COLORS.primary} dotSize={5} />
                  <Text style={styles.loadingMoreText}>Loading more subjects...</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
      <AdBanner />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
    backgroundColor: COLORS.card,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 27,
    fontStyle: 'italic',
    fontWeight: '400',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    marginTop: 14,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13.5,
  },
  content: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // Grid mode: a standalone bordered card instead of a full-bleed row.
  cardGrid: {
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 12,
  },
  cardComingSoon: {
    backgroundColor: COLORS.cardSecondary,
    opacity: 0.85,
  },
  cardSoonTag: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cardSoonTagText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontWeight: '700',
    color: COLORS.textSubtle,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 19,
  },
  subjectNameSoon: {
    color: COLORS.textMuted,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionCount: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  skeletonCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 16,
    marginBottom: 10,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  loadingMoreFooter: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
