import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { useSyllabusSemester } from '../api/queries';
import { BranchSemester, SyllabusSubjectSummary } from '../types/syllabus';
import { getDoneCounts, subscribeProgress } from '../db/syllabusProgress';
import { recordContentOpenedAndMaybeShowInterstitial } from '../utils/ads';
import { ScreenError, ScreenEmpty } from '../components/ScreenState';
import { CircleLoader } from '../components/CircleLoader';
import { userMessage } from '../utils/netError';
import { useContainerStyle } from '../components/ScreenContainer';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * The semester's subject sheet - theory above, labs below, each as a table of
 * subject against topics completed. This is the "main content" screen, so it
 * is where the interstitial is offered: once per open, and the shared
 * frequency cap in utils/ads decides whether one actually shows.
 *
 * Data comes from /syllabus/branches/:branch/semesters/:n, served through the
 * read-through cache.
 */
export const SyllabusOverviewScreen = () => {
  const frame = useContainerStyle('read', false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branchId: string = route.params?.branchId ?? 'cse';
  // Number() because the value arrives as a string over a deep link even
  // though in-app callers pass a number (linking parse covers the URL case;
  // this covers any programmatic string pass-through).
  const semesterNumber: number = Number(route.params?.semester ?? 5);

  const semesterQ = useSyllabusSemester(branchId, semesterNumber);
  const data: BranchSemester | null = semesterQ.data ?? null;
  // Only an error when there is nothing (not even a persisted copy) to show.
  const error =
    semesterQ.isError && !semesterQ.data ? userMessage(semesterQ.error, 'Could not load this semester.') : null;
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Closed on arrival: the credit table is a term-planning reference, checked
  // once or twice a semester, while the subject list underneath is what the
  // screen is actually for. The total stays on the collapsed header so the one
  // number people come back for is readable without opening anything.
  const [creditsOpen, setCreditsOpen] = useState(false);

  // Fires once per screen open. Deliberately not awaited - navigation must
  // never wait on an ad, and the helper swallows its own failures.
  useEffect(() => {
    void recordContentOpenedAndMaybeShowInterstitial();
  }, []);


  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!data) return;
      const load = () =>
        getDoneCounts(data.subjects.map((s) => s.id)).then((c) => {
          if (alive) setCounts(c);
        });
      void load();
      const unsubscribe = subscribeProgress(() => void load());
      return () => {
        alive = false;
        unsubscribe();
      };
    }, [data])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await semesterQ.refetch();
    setRefreshing(false);
  };

  if (!data) {
    return (
      <View style={styles.centerContainer}>
        {error ? (
          <ScreenError message={error} onRetry={() => void semesterQ.refetch()} />
        ) : (
          <CircleLoader color={COLORS.primary} dotSize={6} size={40} />
        )}
      </View>
    );
  }

  const semester = data;
  const theory = semester.subjects.filter((s) => s.kind === 'theory');
  const labs = semester.subjects.filter((s) => s.kind === 'lab');

  const openSubject = (subject: SyllabusSubjectSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SubjectSyllabus', {
      branchId,
      semester: semesterNumber,
      subjectId: subject.id,
      subjectName: subject.name,
    });
  };

  // Subjects as cards rather than a table: the name gets the full row, and the
  // progress bar spans the card so completion is readable at a glance.
  const renderSection = (title: string, rows: SyllabusSubjectSummary[], unit: string) => {
    if (rows.length === 0) return null;
    return (
      <View key={title} style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>{rows.length}</Text>
        </View>
        <View style={styles.cardList}>
          {rows.map((s) => {
            const done = counts[s.id] ?? 0;
            const w = s.topicCount > 0 ? Math.round((done / s.topicCount) * 100) : 0;
            const finished = s.topicCount > 0 && done >= s.topicCount;
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => openSubject(s)}
              >
                <View style={styles.cardTop}>
                  {s.code ? <Text style={styles.codePill}>{s.code}</Text> : <View />}
                  {finished ? (
                    <View style={styles.doneTag}>
                      <Feather name="check" size={11} color={COLORS.secondary} />
                      <Text style={styles.doneTagText}>Done</Text>
                    </View>
                  ) : (
                    <Feather name="chevron-right" size={16} color={COLORS.textSubtle} />
                  )}
                </View>
                <Text style={styles.cardName}>{s.name}</Text>
                <Text style={styles.cardMeta}>
                  {s.kind === 'lab'
                    ? `${s.topicCount} ${unit}`
                    : `${s.moduleCount} modules · ${s.topicCount} ${unit}`}
                </Text>
                <View style={styles.progressRow}>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${w}%` }]} />
                  </View>
                  <Text style={done > 0 ? styles.frac : styles.fracZero}>
                    {done}/{s.topicCount}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Whole-semester progress for the summary card.
  const totalTopics = semester.subjects.reduce((n, s) => n + s.topicCount, 0);
  const totalDone = semester.subjects.reduce((n, s) => n + Math.min(counts[s.id] ?? 0, s.topicCount), 0);
  const overallPct = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0;

  const renderSummary = () => (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryLabel}>SEMESTER {semesterNumber}</Text>
          <Text style={styles.summaryTitle}>
            {totalDone} of {totalTopics} topics done
          </Text>
        </View>
        <Text style={styles.summaryPct}>{overallPct}%</Text>
      </View>
      <View style={styles.summaryBar}>
        <View style={[styles.summaryBarFill, { width: `${overallPct}%` }]} />
      </View>
      <Text style={styles.summaryMeta}>
        {semester.subjects.length} subjects
        {semester.totalCredits ? ` · ${semester.totalCredits} credits` : ''}
      </Text>
    </View>
  );

  // The university prints an L-T-P-credits table at the top of every semester's
  // syllabus; students read it to see how heavy the term is. Only rendered when
  // the data actually carries it - a table of blanks is worse than no table.
  const credited = semester.subjects.filter((s) => s.credits);

  const toggleCredits = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCreditsOpen((v) => !v);
  };

  const renderCreditTable = () => {
    if (credited.length === 0) return null;
    return (
      <View style={styles.creditBlock}>
        <TouchableOpacity style={styles.rule} activeOpacity={0.7} onPress={toggleCredits}>
          <Feather
            name={creditsOpen ? 'chevron-down' : 'chevron-right'}
            size={14}
            color={COLORS.textSubtle}
          />
          <Text style={styles.ruleText}>Credit structure</Text>
          <View style={styles.ruleLine} />
          <Text style={styles.ruleTotal}>{semester.totalCredits} credits</Text>
        </TouchableOpacity>

        {!creditsOpen ? null : (
          <View style={styles.ctable}>
            <View style={styles.crHead}>
              <Text style={[styles.cth, styles.cCourse]}>Course</Text>
              <Text style={[styles.cth, styles.cNum]}>L</Text>
              <Text style={[styles.cth, styles.cNum]}>T</Text>
              <Text style={[styles.cth, styles.cNum]}>P</Text>
              <Text style={[styles.cth, styles.cCred]}>C</Text>
            </View>

            {credited.map((s) => (
              <View key={s.id} style={styles.crRow}>
                <View style={styles.cCourse}>
                  <Text style={styles.cName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.cCode}>{s.code}</Text>
                </View>
                <Text style={[styles.cVal, styles.cNum]}>{s.credits!.l}</Text>
                <Text style={[styles.cVal, styles.cNum]}>{s.credits!.t}</Text>
                <Text style={[styles.cVal, styles.cNum]}>{s.credits!.p}</Text>
                <Text style={[styles.cValStrong, styles.cCred]}>{s.credits!.credits}</Text>
              </View>
            ))}

            <View style={styles.crTotal}>
              <Text style={[styles.cTotalLabel, styles.cCourse]}>Total</Text>
              <Text style={[styles.cValStrong, styles.cCred]}>{semester.totalCredits}</Text>
            </View>
          </View>
        )}

        {creditsOpen && (
          <Text style={styles.cLegend}>
            L lecture · T tutorial · P practical, hours per week
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[frame, { paddingBottom: Math.max(insets.bottom, 16), paddingTop: 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {semester.subjects.length > 0 && renderSummary()}

        {semester.subjects.length === 0 ? (
          <ScreenEmpty message="No syllabus for this semester yet." />
        ) : (
          <>
            {renderSection('Theory', theory, 'topics')}
            {renderSection('Laboratory', labs, 'experiments')}
            {renderCreditTable()}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditBlock: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  ruleText: {
    fontFamily: FONTS.displayBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  ruleLine: { flex: 1, height: 1, backgroundColor: COLORS.borderDashed },
  ruleTotal: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.secondary,
    letterSpacing: 0.3,
  },
  ctable: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border },
  crHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: COLORS.cardSecondary,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  cth: {
    fontFamily: FONTS.displayBold,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  crRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
  },
  crTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.cardSecondary,
  },
  // Fixed widths so the digits form real columns down the table - the whole
  // point of an L-T-P grid is that you can read a column at a glance.
  cCourse: { flex: 1, minWidth: 0 },
  cNum: { width: 26, textAlign: 'center' },
  cCred: { width: 30, textAlign: 'right' },
  cName: { fontFamily: FONTS.bodyMedium, fontSize: 13, lineHeight: 17, color: COLORS.text },
  cCode: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.textSubtle, marginTop: 2 },
  cVal: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
  cValStrong: { fontFamily: FONTS.displayBold, fontSize: 12, color: COLORS.text },
  cTotalLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  cLegend: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 9.5,
    color: COLORS.textSubtle,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  summary: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: COLORS.primary,
  },
  summaryTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    color: COLORS.text,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  summaryPct: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.secondary, letterSpacing: -0.8 },
  summaryBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
    marginTop: 14,
  },
  summaryBarFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.secondary },
  summaryMeta: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted, marginTop: 10 },
  section: { marginBottom: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  sectionCount: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: COLORS.textMuted,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  cardList: { gap: 10, paddingHorizontal: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codePill: {
    fontFamily: FONTS.displayBold,
    fontSize: 10.5,
    color: COLORS.textMuted,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
    letterSpacing: 0.4,
  },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  doneTagText: { fontFamily: FONTS.displayBold, fontSize: 11, color: COLORS.secondary },
  cardName: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
    marginTop: 8,
  },
  cardMeta: { fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.textSubtle, marginTop: 3 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  frac: { fontFamily: FONTS.displayBold, fontSize: 11.5, color: COLORS.secondary },
  fracZero: { fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.textSubtle },
  bar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.secondary },
});
