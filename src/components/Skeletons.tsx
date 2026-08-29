import React, { useEffect, useRef } from 'react';
import { Animated, View, Platform, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { COLORS } from '../theme/colors';

/**
 * Skeleton loading placeholders for the syllabus screens.
 *
 * Each screen's skeleton mirrors its real layout - same row heights, same
 * paddings, same grid - so the loading state reads as "content is coming"
 * rather than a spinner in a void. One shared Animated.Value drives the whole
 * placeholder instead of an animation per bone: a loading screen carries a
 * dozen bones, and a dozen timers is how jank starts.
 */

/** A single placeholder rectangle. Plain view - the pulse lives on the parent. */
const Bone = ({ style }: { style?: StyleProp<ViewStyle> }) => <View style={[styles.bone, style]} />;

/** Wraps a skeleton in a slow opacity pulse shared by all its bones. */
export const SkeletonPulse = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const anim = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(anim, { toValue: 0.3, duration: 750, useNativeDriver: Platform.OS !== 'web' }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[{ opacity: anim }, style]}>{children}</Animated.View>;
};

/** Branch list - code box + two text lines per row, matching BranchScreen. */
export const BranchListSkeleton = () => (
  <SkeletonPulse>
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <View key={i} style={styles.branchRow}>
        <Bone style={styles.codeBox} />
        <View style={styles.rowBody}>
          <Bone style={styles.line} />
          <Bone style={styles.lineShort} />
        </View>
      </View>
    ))}
  </SkeletonPulse>
);

/** Semester grid - header bones + the 2-up cards, matching SemesterSelect. */
export const SemesterGridSkeleton = () => (
  <SkeletonPulse>
    <View style={styles.head}>
      <Bone style={styles.kickerBone} />
      <Bone style={styles.titleBone} />
      <Bone style={styles.subBone} />
    </View>
    <View style={styles.grid}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.sCard}>
          <Bone style={styles.sLabel} />
          <Bone style={styles.sNum} />
          <Bone style={styles.sMeta} />
          <Bone style={styles.sBar} />
        </View>
      ))}
    </View>
  </SkeletonPulse>
);

/** Subject table - header rule + column headers + rows, matching SyllabusOverview. */
export const SemesterTableSkeleton = () => (
  <SkeletonPulse>
    <View style={styles.rule}>
      <Bone style={styles.ruleBone} />
      <Bone style={styles.ruleLineBone} />
      <Bone style={styles.ruleTotalBone} />
    </View>
    <Bone style={styles.theadBone} />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={styles.tRow}>
        <Bone style={styles.tCode} />
        <View style={styles.rowBody}>
          <Bone style={styles.line} />
          <Bone style={styles.lineShort} />
        </View>
        <View style={styles.tProg}>
          <Bone style={styles.tFrac} />
          <Bone style={styles.tBar} />
        </View>
      </View>
    ))}
  </SkeletonPulse>
);

/** Subject detail - header + module accordions + topic rows, matching SubjectSyllabus. */
export const SubjectSkeleton = () => (
  <SkeletonPulse>
    <View style={styles.subjHead}>
      <View style={styles.badgeRow}>
        <Bone style={styles.codeBone} />
        <Bone style={styles.kindBone} />
      </View>
      <Bone style={styles.titleBone} />
      <View style={styles.progRow}>
        <Bone style={styles.progBar} />
        <Bone style={styles.progFrac} />
      </View>
      <Bone style={styles.subBone} />
    </View>

    {[0, 1, 2].map((m) => (
      <View key={m}>
        <View style={styles.modHead}>
          <Bone style={styles.chevBone} />
          <View style={styles.rowBody}>
            <Bone style={styles.modNumBone} />
            <Bone style={styles.line} />
          </View>
          <Bone style={styles.modCountBone} />
        </View>
        <View style={styles.topicRow}>
          <Bone style={styles.bubbleBone} />
          <Bone style={[styles.line, styles.topicLine]} />
        </View>
        <View style={styles.topicRow}>
          <Bone style={styles.bubbleBone} />
          <Bone style={[styles.line, styles.topicLineShort]} />
        </View>
      </View>
    ))}
  </SkeletonPulse>
);

const styles = StyleSheet.create({
  bone: { backgroundColor: COLORS.borderLight, borderRadius: 4 },

  // Shared bits
  codeBox: { width: 46, height: 34 },
  rowBody: { flex: 1 },
  line: { height: 14, borderRadius: 4 },
  lineShort: { height: 10, width: '45%', marginTop: 6, borderRadius: 4 },
  head: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  kickerBone: { height: 10, width: '28%' },
  titleBone: { height: 24, width: '55%', marginTop: 10 },
  subBone: { height: 12, width: '80%', marginTop: 8 },

  // Branch list
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 68,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: -1,
  },

  // Semester grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  sCard: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 112,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  sLabel: { height: 9, width: '42%' },
  sNum: { height: 28, width: '32%' },
  sMeta: { height: 10, width: '72%' },
  sBar: { height: 4, width: '100%', borderRadius: 2, marginTop: 4 },

  // Subject table
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },
  ruleBone: { height: 10, width: 130 },
  ruleLineBone: { flex: 1, height: 1 },
  ruleTotalBone: { height: 10, width: 56 },
  theadBone: { height: 28, marginHorizontal: 16 },
  tRow: {
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
  tCode: { width: 52, height: 11 },
  tProg: { width: 62, alignItems: 'flex-end', gap: 6 },
  tFrac: { height: 11, width: 40 },
  tBar: { height: 4, width: '100%', borderRadius: 2 },

  // Subject detail
  subjHead: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: COLORS.borderDashed,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  codeBone: { height: 11, width: 72 },
  kindBone: { height: 20, width: 64, borderRadius: 4 },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  progBar: { flex: 1, height: 4, borderRadius: 2 },
  progFrac: { height: 11, width: 44 },
  chevBone: { width: 12, height: 12 },
  modHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 58,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  modNumBone: { height: 10, width: 90, marginBottom: 5 },
  modCountBone: { height: 12, width: 26 },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderColor: COLORS.borderLight,
    paddingLeft: 16,
    paddingRight: 10,
    minHeight: 52,
  },
  bubbleBone: { width: 20, height: 20, borderRadius: 10 },
  topicLine: { flex: 1 },
  topicLineShort: { flex: 1, width: '70%' },
});
