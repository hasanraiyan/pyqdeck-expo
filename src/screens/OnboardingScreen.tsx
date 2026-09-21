import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { markOnboardingDone } from '../utils/onboarding';
import { COLORS, FONTS } from '../theme/colors';
import { MarksBadge, YearBadge } from '../components/Badge';
import { QuestionItemClassic } from '../components/QuestionItemClassic';
import { QuestionSummary } from '../types';
import { rf } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEMO_QUESTION: QuestionSummary = {
  questionId: 'demo-q1',
  year: 2023,
  qNumber: 'Q4a',
  chapter: 'Module 3: Memory Management',
  text: 'Explain the difference between **Paging** and **Segmentation** with suitable architectural diagrams.',
  textPreview: 'Explain the difference between Paging and Segmentation with suitable diagrams.',
  textHtml: '',
  type: 'theory',
  marks: 14,
  hasSolution: true,
};

const SLIDES = [
  {
    kicker: 'PAST QUESTION PAPERS',
    heading: 'Every exam paper,\nin one place.',
    body: 'Browse questions by semester, subject, or year — exactly the way your university organises them.',
  },
  {
    kicker: 'QUICK RESUME',
    heading: 'Pick up right\nwhere you left off.',
    body: 'Jump Back In shows your recently studied subjects the moment you open the app. One tap, back to work.',
  },
  {
    kicker: 'SMART SEARCH',
    heading: 'Find any question\nin seconds.',
    body: 'Search by keyword across every subject and year. Results appear instantly as you type.',
  },
];

/* Slide 1 Demo: Real QuestionItemClassic Component + Year Chips */
function DemoQuestionCard() {
  return (
    <View style={styles.demoContainer}>
      {/* 1-Tap Year Chips Bar */}
      <View style={styles.demoChipsRow}>
        <View style={styles.demoChip}>
          <Text style={styles.demoChipText}>All</Text>
        </View>
        <View style={[styles.demoChip, styles.demoChipActive]}>
          <Text style={[styles.demoChipText, styles.demoChipTextActive]}>2023</Text>
        </View>
        <View style={styles.demoChip}>
          <Text style={styles.demoChipText}>2022</Text>
        </View>
        <View style={styles.demoChip}>
          <Text style={styles.demoChipText}>2021</Text>
        </View>
      </View>

      {/* Real QuestionItemClassic component */}
      <QuestionItemClassic
        question={DEMO_QUESTION}
        subjectId="operating-systems"
        semesterId="5"
        subjectName="Operating Systems"
      />
    </View>
  );
}

/* Slide 2 Demo: Jump Back In Full Card */
function DemoJumpBackIn() {
  return (
    <View style={styles.demoContainer}>
      {/* Zap Header */}
      <View style={styles.demoZapRow}>
        <Feather name="zap" size={12} color={COLORS.primary} />
        <Text style={styles.demoZapHeading}>JUMP BACK IN</Text>
      </View>

      {/* Realistic Jump Card */}
      <View style={[styles.demoCard, styles.demoJumpCard]}>
        <View style={styles.demoCardHeader}>
          <Text style={styles.demoCodeText}>CS301 · SEMESTER 3</Text>
          <View style={styles.demoRecentPill}>
            <Text style={styles.demoRecentPillText}>Studied recently</Text>
          </View>
        </View>

        <Text style={styles.demoJumpTitle} numberOfLines={1}>
          Data Structures & Algorithms
        </Text>
        <Text style={styles.demoJumpSub}>
          2023 Paper · 28 Questions
        </Text>

        <View style={styles.demoJumpFooter}>
          <Text style={styles.demoResumeText}>Tap to resume</Text>
          <View style={styles.demoArrowCircle}>
            <Feather name="arrow-right" size={12} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  );
}

/* Slide 3 Demo: Instant Search Card */
function DemoSearch() {
  return (
    <View style={styles.demoContainer}>
      {/* Search Input Mock */}
      <View style={styles.demoSearchBar}>
        <Feather name="search" size={13} color={COLORS.primary} />
        <Text style={styles.demoSearchInputText}>binary search tree</Text>
        <View style={styles.demoClearCircle}>
          <Feather name="x" size={10} color={COLORS.textMuted} />
        </View>
      </View>

      {/* Search Result Card */}
      <View style={styles.demoCard}>
        <Text style={styles.demoResultKicker}>DATA STRUCTURES · 0.984 MATCH</Text>
        <Text style={styles.demoQuestionText} numberOfLines={2}>
          Write an algorithm to insert and delete nodes in a Binary Search Tree (BST)...
        </Text>
        <View style={styles.demoBadgesRow}>
          <YearBadge year={2022} variant="teal" />
          <MarksBadge marks={7} />
          <View style={styles.demoModulePill}>
            <Text style={styles.demoModuleText}>MOD 4</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface Props {
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goNext = async () => {
    Haptics.selectionAsync();
    if (activeIndex < SLIDES.length - 1) {
      const next = activeIndex + 1;
      scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * next, animated: true });
      setActiveIndex(next);
    } else {
      await markOnboardingDone();
      onDone();
    }
  };

  const skip = async () => {
    Haptics.selectionAsync();
    await markOnboardingDone();
    onDone();
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offset / SCREEN_WIDTH);
    if (newIndex !== activeIndex) {
      Haptics.selectionAsync();
      setActiveIndex(newIndex);
    }
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Visual Demo UI Mockup */}
            <View style={styles.demoWrapper}>
              {idx === 0 && <DemoQuestionCard />}
              {idx === 1 && <DemoJumpBackIn />}
              {idx === 2 && <DemoSearch />}
            </View>

            {/* Slide Information */}
            <View style={styles.copyWrapper}>
              <Text style={styles.kicker}>{slide.kicker}</Text>
              <Text style={styles.heading}>{slide.heading}</Text>
              <View style={styles.divider} />
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Skip */}
        <TouchableOpacity
          onPress={skip}
          style={styles.skipBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>{isLast ? '' : 'Skip'}</Text>
        </TouchableOpacity>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{isLast ? 'Get Started' : 'Next'}</Text>
          {!isLast && (
            <Feather name="arrow-right" size={14} color="#fff" style={{ marginLeft: 6 }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 0,
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 20,
  },
  demoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
  },
  demoContainer: {
    width: '100%',
  },

  /* Demo Year Chips */
  demoChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  demoChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  demoChipText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    color: COLORS.textMuted,
  },
  demoChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* Demo Card Generic */
  demoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginHorizontal: 16,
  },
  demoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  demoSubjectName: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
    letterSpacing: 0.8,
  },
  demoSolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoSolvedText: {
    fontFamily: FONTS.mono,
    fontSize: rf(8.5),
    fontWeight: '700',
    color: COLORS.secondary,
    letterSpacing: 0.5,
  },
  demoQuestionText: {
    fontFamily: FONTS.serif,
    fontSize: rf(13.5),
    color: COLORS.text,
    lineHeight: rf(20),
    marginBottom: 10,
  },
  demoBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoModulePill: {
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoModuleText: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
    letterSpacing: 0.5,
  },

  /* Demo Jump Back In */
  demoZapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  demoZapHeading: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.2,
  },
  demoJumpCard: {
    backgroundColor: COLORS.card,
  },
  demoCodeText: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 0.5,
  },
  demoRecentPill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoRecentPillText: {
    fontFamily: FONTS.mono,
    fontSize: rf(8.5),
    color: COLORS.primary,
    fontWeight: '600',
  },
  demoJumpTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(15),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  demoJumpSub: {
    fontFamily: FONTS.sans,
    fontSize: rf(12),
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  demoJumpFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  demoResumeText: {
    fontFamily: FONTS.sans,
    fontSize: rf(12),
    fontWeight: '600',
    color: COLORS.primary,
  },
  demoArrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Demo Search */
  demoSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    marginHorizontal: 16,
    gap: 8,
  },
  demoSearchInputText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: rf(12.5),
    color: COLORS.text,
  },
  demoClearCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoResultKicker: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
    letterSpacing: 0.8,
    marginBottom: 6,
  },

  /* Copy Section */
  copyWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: {
    fontFamily: FONTS.serif,
    fontSize: rf(26),
    color: COLORS.text,
    lineHeight: rf(34),
    marginBottom: 14,
  },
  divider: {
    width: 36,
    height: 2,
    backgroundColor: COLORS.primaryBorder,
    borderRadius: 2,
    marginBottom: 14,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: rf(14),
    color: COLORS.textMuted,
    lineHeight: rf(21),
  },

  /* Bottom Bar */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  skipBtn: {
    minWidth: 48,
  },
  skipText: {
    fontFamily: FONTS.sans,
    fontSize: rf(14),
    color: COLORS.textMuted,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    width: 7,
    backgroundColor: COLORS.border,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 48,
    justifyContent: 'center',
  },
  nextText: {
    fontFamily: FONTS.sans,
    fontSize: rf(14),
    fontWeight: '600',
    color: '#fff',
  },
});

