import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { listAllSubjects } from '../api';
import { SubjectSummary, Semester } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';

export const AllSubjectsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [subjects, setSubjects] = useState<(SubjectSummary & { semester: Semester })[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (q = query, p = page) => {
    setLoading(true);
    try {
      const res = await listAllSubjects({ q: q.trim() || undefined, page: p });
      setSubjects(res.subjects || []);
      setPageCount(res.pageCount || 1);
      setTotal(res.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(query, page);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    loadData(query, 1);
  };

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
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <Skeleton width="60%" height={18} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={12} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={subjects}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 16 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData(query, page);
                }}
                tintColor={COLORS.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No subjects found.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
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
                  </View>
                  <Text style={styles.subjectName}>{item.name}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.questionCount}>{item.questionCount}q</Text>
                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {/* Pagination controls */}
        {pageCount > 1 && (
          <View style={styles.paginationBar}>
            <TouchableOpacity
              disabled={page <= 1}
              style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Feather name="chevron-left" size={16} color={page <= 1 ? COLORS.textSubtle : COLORS.text} />
              <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>
                Prev
              </Text>
            </TouchableOpacity>

            <Text style={styles.pageIndicator}>
              Page {page} of {pageCount}
            </Text>

            <TouchableOpacity
              disabled={page >= pageCount}
              style={[styles.pageButton, page >= pageCount && styles.pageButtonDisabled]}
              onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              <Text style={[styles.pageBtnText, page >= pageCount && styles.pageBtnTextDisabled]}>
                Next
              </Text>
              <Feather name="chevron-right" size={16} color={page >= pageCount ? COLORS.textSubtle : COLORS.text} />
            </TouchableOpacity>
          </View>
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
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  subjectName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 19,
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
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSecondary,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  pageBtnTextDisabled: {
    color: COLORS.textSubtle,
  },
  pageIndicator: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
