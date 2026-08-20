import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { listAllSubjects } from '../api';
import { SubjectSummary, Semester } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';

export const AllSubjectsScreen = () => {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [subjects, setSubjects] = useState<(SubjectSummary & { semester: Semester })[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (q: string, p: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await listAllSubjects({ q: q.trim() || undefined, page: p });
      if (append) {
        setSubjects((prev) => [...prev, ...(res.subjects || [])]);
      } else {
        setSubjects(res.subjects || []);
      }
      setPageCount(res.pageCount || 1);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(query, 1, false);
  }, []);

  const handleSearch = () => {
    setPage(1);
    loadData(query, 1, false);
  };

  const handleEndReached = () => {
    if (!loading && !loadingMore && page < pageCount) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadData(query, nextPage, true);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadData(query, 1, false);
  };

  const renderSubjectCard = useCallback(
    ({ item }: { item: SubjectSummary & { semester: Semester } }) => {
      const isComingSoon = item.questionCount === 0;
      return (
        <TouchableOpacity
          style={[styles.card, isComingSoon && styles.cardComingSoon]}
          activeOpacity={isComingSoon ? 1 : 0.7}
          disabled={isComingSoon}
          onPress={() =>
            navigation.navigate('SubjectDetail', {
              semesterId: item.semester?.id,
              subjectId: item.id,
              subjectName: item.name,
              subjectCode: item.code,
            })
          }
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
    [navigation]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
              if (!text) {
                setPage(1);
                loadData('', 1, false);
              }
            }}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.content}>
        {loading && !refreshing ? (
          <View style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <Skeleton width="40%" height={16} style={{ marginBottom: 8 }} />
                <Skeleton width="70%" height={14} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={subjects}
            keyExtractor={(item) => item.id}
            renderItem={renderSubjectCard}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ paddingBottom: 24 }}
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
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingMoreText}>Loading more subjects...</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
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
