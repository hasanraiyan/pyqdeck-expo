import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { topicQuestionsQuery } from '../api/queries';
import type { TopicQuestion } from '../api';
import { COLORS, FONTS } from '../theme/colors';
import { QuestionItem } from '../components/QuestionItem';
import { QuestionItemClassic } from '../components/QuestionItemClassic';
import { ScreenEmpty, ScreenError } from '../components/ScreenState';
import { CircleLoader } from '../components/CircleLoader';
import { peekOldUiEnabled, getOldUiEnabled } from '../utils/settings';
import { userMessage } from '../utils/netError';
import { useContainerStyle } from '../components/ScreenContainer';

/**
 * The past-paper questions an admin has linked to ONE syllabus topic, newest year
 * first. Rows are the same ones the PYQ tab uses, so opening, solutions, sharing
 * and prev/next behave exactly as there.
 */
export const TopicQuestionsScreen = () => {
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const frame = useContainerStyle('read', false);
  const { subjectId, subjectName, topicId, topicTitle, moduleId, moduleName, semesterId } =
    route.params ?? {};

  const [year, setYear] = useState<number | undefined>(undefined);
  const [solvedOnly, setSolvedOnly] = useState(false);
  const [oldUi, setOldUi] = useState<boolean | null>(peekOldUiEnabled());
  React.useEffect(() => {
    void getOldUiEnabled().then(setOldUi);
  }, []);

  const q = useInfiniteQuery(
    topicQuestionsQuery(subjectId, topicId, { year, hasSolution: solvedOnly ? true : undefined })
  );
  const pages = q.data?.pages ?? [];
  const questions: TopicQuestion[] = useMemo(() => pages.flatMap((p) => p.questions), [pages]);
  // The header numbers describe the whole topic, so read them from the first page.
  const summary = pages[0]?.summary;
  const [refreshing, setRefreshing] = useState(false);

  const renderItem = useCallback(
    ({ item }: { item: TopicQuestion }) => {
      const rowSubject = item.subjectId ?? subjectId;
      const Row = oldUi ? QuestionItemClassic : QuestionItem;
      return (
        <Row
          question={item}
          subjectId={rowSubject}
          semesterId={semesterId ?? ''}
          subjectName={item.subjectName ?? subjectName}
          hideYearBadge={false}
        />
      );
    },
    [oldUi, subjectId, subjectName, semesterId]
  );

  if (!subjectId || !topicId) {
    return (
      <View style={styles.center}>
        <ScreenEmpty message="No topic selected." />
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.kicker}>{moduleName ? moduleName.toUpperCase() : 'PAST PAPERS'}</Text>
      <Text style={styles.title}>{topicTitle}</Text>
      {summary ? (
        <Text style={styles.sub}>
          {summary.count} question{summary.count === 1 ? '' : 's'} asked
          {summary.years.length > 0 ? ` across ${summary.years.length} year${summary.years.length === 1 ? '' : 's'}` : ''}
          {summary.withSolution > 0 ? ` · ${summary.withSolution} with solutions` : ''}
        </Text>
      ) : null}

      {summary && (summary.years.length > 1 || summary.withSolution > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <TouchableOpacity
            style={[styles.chip, !year && styles.chipActive]}
            onPress={() => setYear(undefined)}
          >
            <Text style={[styles.chipText, !year && styles.chipTextActive]}>All years</Text>
          </TouchableOpacity>
          {summary.years.map((y) => (
            <TouchableOpacity
              key={y.year}
              style={[styles.chip, year === y.year && styles.chipActive]}
              onPress={() => setYear(year === y.year ? undefined : y.year)}
            >
              <Text style={[styles.chipText, year === y.year && styles.chipTextActive]}>
                {y.year} ({y.count})
              </Text>
            </TouchableOpacity>
          ))}
          {summary.withSolution > 0 && (
            <TouchableOpacity
              style={[styles.chip, solvedOnly && styles.chipActive]}
              onPress={() => setSolvedOnly((v) => !v)}
            >
              <Feather name="check-circle" size={12} color={solvedOnly ? '#fff' : COLORS.secondary} />
              <Text style={[styles.chipText, solvedOnly && styles.chipTextActive]}>With solution</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : null}
    </View>
  );

  if (q.isLoading) {
    return (
      <View style={styles.center}>
        <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
      </View>
    );
  }

  if (q.isError && questions.length === 0) {
    return (
      <View style={styles.center}>
        <ScreenError
          message={userMessage(q.error, 'Could not load these questions.')}
          onRetry={() => void q.refetch()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={oldUi === null ? [] : questions}
        keyExtractor={(item) => `${item.subjectId}:${item.questionId}`}
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={[frame, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        initialNumToRender={8}
        windowSize={5}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await q.refetch();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <ScreenEmpty message={year || solvedOnly ? 'No questions match these filters.' : 'No questions are linked to this topic yet.'} />
        }
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={{ padding: 16 }}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 6 },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.1, color: COLORS.primary },
  title: { fontFamily: FONTS.displayBold, fontSize: 21, lineHeight: 27, color: COLORS.text },
  sub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted },
  chips: { gap: 8, paddingTop: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.text },
  chipTextActive: { color: '#fff' },
});
