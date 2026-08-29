import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { getSemester } from '../data/syllabus';
import { SyllabusSubject, topicCountOf } from '../types/syllabus';
import { getDoneCounts } from '../db/syllabusProgress';
import { recordContentOpenedAndMaybeShowInterstitial } from '../utils/ads';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * The semester's subject sheet - theory above, labs below, each as a table of
 * subject against topics completed. This is the "main content" screen, so it
 * is where the interstitial is offered: once per open, and the shared
 * frequency cap in utils/ads decides whether one actually shows.
 */
export const SyllabusOverviewScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const branchId: string = route.params?.branchId ?? 'cse';
  const semesterNumber: number = route.params?.semester ?? 5;

  const semester = useMemo(
    () => getSemester(branchId, semesterNumber),
    [branchId, semesterNumber]
  );
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
      if (!semester) return;
      getDoneCounts(semester.subjects.map((s) => s.id)).then((c) => {
        if (alive) setCounts(c);
      });
      return () => {
        alive = false;
      };
    }, [semester])
  );

  if (!semester) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.emptyText}>Syllabus for this semester has not been added yet.</Text>
      </View>
    );
  }

  const theory = semester.subjects.filter((s) => s.kind === 'theory');
  const labs = semester.subjects.filter((s) => s.kind === 'lab');
  const totalTopics = semester.subjects.reduce((n, s) => n + topicCountOf(s), 0);
  const totalDone = semester.subjects.reduce((n, s) => n + (counts[s.id] ?? 0), 0);
  const pct = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0;

  const openSubject = (subject: SyllabusSubject) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SubjectSyllabus', {
      branchId,
      semester: semesterNumber,
      subjectId: subject.id,
      subjectName: subject.name,
    });
  };

  const renderTable = (title: string, rows: SyllabusSubject[], unit: string) => {
    if (rows.length === 0) return null;
    return (
      <View key={title}>
        <View style={styles.thead}>
          <Text style={[styles.th, { width: 52 }]}>Code</Text>
          <Text style={[styles.th, { flex: 1 }]}>{title}</Text>
          <Text style={[styles.th, { width: 62, textAlign: 'right' }]}>Done</Text>
        </View>
        {rows.map((s) => {
          const total = topicCountOf(s);
          const done = counts[s.id] ?? 0;
          const w = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <TouchableOpacity
              key={s.id}
              style={styles.trow}
              activeOpacity={0.6}
              onPress={() => openSubject(s)}
            >
              <Text style={styles.tcode}>{s.code}</Text>
              <View style={styles.tname}>
                <Text style={styles.tnm}>{s.name}</Text>
                <Text style={styles.tmeta}>
                  {s.kind === 'lab'
                    ? `${total} ${unit}`
                    : `${s.modules.length} modules · ${total} ${unit}`}
                </Text>
              </View>
              <View style={styles.tprog}>
                <Text style={done > 0 ? styles.tfrac : styles.tfracZero}>
                  {done} / {total}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { width: `${w}%` }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // The university prints an L-T-P-credits table at the top of every semester's
  // syllabus; students read it to see how heavy the term is. Only rendered when
  // the data actually carries it - a table of blanks is worse than no table.
  const credited = semester.subjects.filter((s) => s.credits);
  const totalCredits = credited.reduce((n, s) => n + (s.credits?.credits ?? 0), 0);

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
          <Text style={styles.ruleTotal}>{totalCredits} credits</Text>
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
            <Text style={[styles.cValStrong, styles.cCred]}>{totalCredits}</Text>
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
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.head}>
          <Text style={styles.title}>Semester {semesterNumber} syllabus</Text>
          <View style={styles.headProg}>
            <View style={[styles.bar, { flex: 1 }]}>
              <View style={[styles.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.headFrac}>
              {totalDone} / {totalTopics}
            </Text>
          </View>
          <Text style={styles.sub}>
            Topics you have marked done, across every subject this semester.
          </Text>
        </View>

        {renderCreditTable()}

        {renderTable('Theory subject', theory, 'topics')}
        {renderTable('Laboratory', labs, 'experiments')}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 25,
    fontStyle: 'italic',
    color: COLORS.text,
    lineHeight: 31,
    letterSpacing: -0.5,
  },
  headProg: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  headFrac: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  sub: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 6, lineHeight: 18 },
  creditBlock: { paddingBottom: 18 },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },
  ruleText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  ruleLine: { flex: 1, height: 1, backgroundColor: COLORS.borderDashed },
  ruleTotal: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
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
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
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
  cName: { fontSize: 13, lineHeight: 17, color: COLORS.text },
  cCode: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textSubtle, marginTop: 2 },
  cVal: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textMuted },
  cValStrong: { fontFamily: FONTS.mono, fontSize: 12, fontWeight: '700', color: COLORS.text },
  cTotalLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  cLegend: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    color: COLORS.textSubtle,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: COLORS.cardSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  th: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.textSubtle,
  },
  trow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 62,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tcode: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    width: 52,
  },
  tname: { flex: 1 },
  tnm: { fontSize: 14, lineHeight: 18, color: COLORS.text },
  tmeta: { fontFamily: FONTS.mono, fontSize: 10.5, color: COLORS.textSubtle, marginTop: 3 },
  tprog: { width: 62, alignItems: 'flex-end' },
  tfrac: {
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  tfracZero: { fontFamily: FONTS.mono, fontSize: 11.5, color: COLORS.textSubtle },
  bar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderLight,
    overflow: 'hidden',
    marginTop: 5,
    alignSelf: 'stretch',
  },
  barFill: { height: '100%', backgroundColor: COLORS.secondary },
});
