import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getSubjectMeta } from '../api';
import { SubjectMeta } from '../types';
import { COLORS, FONTS } from '../theme/colors';
import { Skeleton } from '../components/Skeleton';
import { Badge } from '../components/Badge';

export const SubjectDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { semesterId, subjectId, subjectName, subjectCode } = route.params || {};

  const [meta, setMeta] = useState<SubjectMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await getSubjectMeta(subjectId);
      setMeta(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Subject Header */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            {subjectCode ? <Badge label={subjectCode} variant="secondary" /> : null}
            <Text style={styles.semLabel}>
              {semesterId ? `SEMESTER ${semesterId.replace(/\D/g, '')}` : 'SUBJECT'}
            </Text>
          </View>
          <Text style={styles.title}>{meta?.name || subjectName}</Text>
          <Text style={styles.subtitle}>
            {meta?.years?.reduce((n, y) => n + y.questionCount, 0) ?? '—'} questions available across{' '}
            {meta?.years?.length ?? '—'} exam papers.
          </Text>
        </View>

        {/* Papers by Year */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>QUESTION PAPERS BY YEAR</Text>
          {loading ? (
            <View style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.yearCardSkeleton}>
                  <Skeleton width={60} height={24} style={{ marginBottom: 6 }} />
                  <Skeleton width={40} height={12} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {meta?.years?.map((y) => (
                <TouchableOpacity
                  key={y.year}
                  style={styles.yearCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('QuestionList', {
                      semesterId,
                      subjectId,
                      subjectName: meta?.name || subjectName,
                      subjectCode,
                      initialYear: y.year,
                    })
                  }
                >
                  <Text style={styles.yearNumber}>{y.year}</Text>
                  <Text style={styles.yearSubtext}>
                    {y.questionCount} question{y.questionCount === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Modules / Chapters Section */}
        {meta?.chapters && meta.chapters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>PRACTICE BY MODULE</Text>
            <View style={styles.moduleList}>
              {meta.chapters.map((ch, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.moduleCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('QuestionList', {
                      semesterId,
                      subjectId,
                      subjectName: meta?.name || subjectName,
                      subjectCode,
                      initialChapter: ch.chapter,
                    })
                  }
                >
                  <View style={styles.moduleLeft}>
                    <Text style={styles.moduleName}>{ch.chapter}</Text>
                    <Text style={styles.moduleCount}>
                      {ch.questionCount} question{ch.questionCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={15} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    paddingBottom: 40,
  },
  header: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  semLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSubtle,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 25,
    fontStyle: 'italic',
    fontWeight: '400',
    color: COLORS.text,
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 19,
  },
  section: {
    marginTop: 22,
  },
  sectionHeading: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  yearCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  yearCardSkeleton: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  yearNumber: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    fontStyle: 'italic',
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  yearSubtext: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    color: COLORS.textMuted,
  },
  moduleList: {
    gap: 8,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  moduleLeft: {
    flex: 1,
    paddingRight: 10,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  moduleCount: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

