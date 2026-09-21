import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { markOnboardingDone } from '../utils/onboarding';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from '../utils/responsive';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'book-open' as const,
    kicker: 'PAST QUESTION PAPERS',
    heading: 'Every exam paper,\nin one place.',
    body: 'Browse questions by semester, subject, or year — exactly the way your university organises them.',
  },
  {
    icon: 'zap' as const,
    kicker: 'QUICK RESUME',
    heading: 'Pick up right\nwhere you left off.',
    body: 'Jump Back In shows your recently studied subjects the moment you open the app. One tap, back to work.',
  },
  {
    icon: 'search' as const,
    kicker: 'SMART SEARCH',
    heading: 'Find any question\nin seconds.',
    body: 'Search by keyword across every subject and year. Results appear instantly as you type.',
  },
];

interface Props {
  onDone: () => void;
}

export function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const goNext = async () => {
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
    await markOnboardingDone();
    onDone();
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, idx) => (
          <View key={idx} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Icon badge */}
            <View style={styles.iconBadge}>
              <Feather name={slide.icon} size={28} color={COLORS.primary} />
            </View>

            {/* Kicker */}
            <Text style={styles.kicker}>{slide.kicker}</Text>

            {/* Heading */}
            <Text style={styles.heading}>{slide.heading}</Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Body */}
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {/* Skip */}
        <TouchableOpacity onPress={skip} style={styles.skipBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
    paddingHorizontal: 36,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  kicker: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heading: {
    fontFamily: FONTS.serif,
    fontSize: rf(30),
    color: COLORS.text,
    lineHeight: rf(38),
    marginBottom: 20,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.primaryBorder,
    borderRadius: 2,
    marginBottom: 20,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: rf(15.5),
    color: COLORS.textMuted,
    lineHeight: rf(24),
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
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
