import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  TouchableOpacity,
  LayoutChangeEvent,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { StepperItem } from '../utils/stepperParser';

interface StepperTimelineBlockProps {
  steps: StepperItem[];
  renderContent?: (content: string) => React.ReactNode;
}

const DOT_SIZE = 28;
const DOT_GAP = 8;
// At most this many dots are visible at once; more steps scroll sideways.
const MAX_VISIBLE_DOTS = 6;
const DOT_STEP = DOT_SIZE + DOT_GAP;

export const StepperTimelineBlock: React.FC<StepperTimelineBlockProps> = React.memo(({
  steps,
  renderContent,
}) => {
  const [mode, setMode] = useState<'paged' | 'list'>('paged');

  // Identity of the step sequence. This block can stay mounted while the
  // document behind it is replaced (stable key at the same block index), so
  // the selected page and view mode must restart when the steps change.
  const signature = useMemo(
    () =>
      (steps || [])
        .map((st) => `${st.stepNumber}\u0001${st.title || ''}\u0001${st.content}`)
        .join('\u0002'),
    [steps]
  );
  const [seenSignature, setSeenSignature] = useState(signature);
  if (seenSignature !== signature) {
    setSeenSignature(signature);
    setMode('paged');
  }

  if (!steps || steps.length === 0) return null;

  if (mode === 'paged') {
    return (
      <PagedStepper
        key={signature}
        steps={steps}
        renderContent={renderContent}
        onViewAll={() => setMode('list')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>ALGORITHMIC EXECUTION STEPS</Text>
          <Text style={styles.stepsCountBadge}>{steps.length} STEPS</Text>
        </View>

        <View style={styles.timelineBody}>
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;

            return (
              <View key={`step-${index}`} style={styles.stepRow}>
                {/* Left Timeline Column (Node Circle + Connecting Vertical Line) */}
                <View style={styles.nodeColumn}>
                  <View
                    style={styles.circleNode}
                    accessibilityLabel={`Step ${step.stepNumber}: ${step.title || ''}`}
                  >
                    <Text style={styles.circleNodeText} numberOfLines={1}>
                      {step.stepNumber}
                    </Text>
                  </View>

                  {!isLast && <View style={styles.connectingLine} />}
                </View>

                {/* Right Content Column */}
                <View
                  style={[
                    styles.contentColumn,
                    isLast && styles.contentColumnLast,
                  ]}
                >
                  {Boolean(step.title) && (
                    <Text style={styles.stepTitle}>
                      {step.title}
                    </Text>
                  )}

                  <View style={styles.stepContentWrap}>
                    {renderContent ? (
                      renderContent(step.content)
                    ) : (
                      <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                        {step.content}
                      </Markdown>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.viewToggleBtn}
          activeOpacity={0.7}
          onPress={() => setMode('paged')}
          accessibilityRole="button"
          accessibilityLabel="View step by step"
        >
          <Text style={styles.viewToggleText}>View step by step</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

interface PagedStepperProps extends StepperTimelineBlockProps {
  onViewAll: () => void;
}

const PagedStepper: React.FC<PagedStepperProps> = ({ steps, renderContent, onViewAll }) => {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, steps.length - 1);
  const step = steps[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;

  // Native-driver value for the sliding highlight, JS-driven twin for the
  // per-dot number colour (colour can't run on the native driver).
  // The highlight's two edges, in dot units. The edge facing the direction of
  // travel runs ahead and the other trails behind, so the pill stretches and
  // then catches up - an elastic, liquid feel without any overshoot.
  const leadEdge = useRef(new Animated.Value(0)).current;
  const trailEdge = useRef(new Animated.Value(0)).current;
  const forward = useRef(true);
  const renderedIndex = useRef(0);
  if (renderedIndex.current !== safeIndex) {
    forward.current = safeIndex > renderedIndex.current;
    renderedIndex.current = safeIndex;
  }
  const slideJs = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentShift = useRef(new Animated.Value(0)).current;
  const dotsScrollRef = useRef<ScrollView>(null);
  const dotsViewWidth = useRef(0);
  const prevIndex = useRef(0);

  useEffect(() => {
    // Highlight glides across every dot between the old and new step.
    const distance = Math.abs(safeIndex - prevIndex.current);
    const duration = Math.min(700, 380 + distance * 70);
    Animated.parallel([
      Animated.timing(leadEdge, {
        toValue: safeIndex,
        duration: duration * 0.6,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(trailEdge, {
        toValue: safeIndex,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(slideJs, {
        toValue: safeIndex,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // Content slides in from the direction we are travelling.
    if (safeIndex !== prevIndex.current) {
      const dir = safeIndex > prevIndex.current ? 1 : -1;
      contentOpacity.setValue(0);
      contentShift.setValue(dir * 24);
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(contentShift, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Keep the active dot in view when there are many steps.
    const target = safeIndex * DOT_STEP - dotsViewWidth.current / 2 + DOT_SIZE / 2;
    dotsScrollRef.current?.scrollTo({ x: Math.max(0, target), animated: true });

    prevIndex.current = safeIndex;
  }, [safeIndex, leadEdge, trailEdge, slideJs, contentOpacity, contentShift]);

  const onDotsLayout = useCallback((e: LayoutChangeEvent) => {
    dotsViewWidth.current = e.nativeEvent.layout.width;
  }, []);

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(steps.length - 1, i)));

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Animated.View
          style={[
            styles.pagedBody,
            { opacity: contentOpacity, transform: [{ translateX: contentShift }] },
          ]}
        >
          {Boolean(step.title) && <Text style={styles.pagedTitle}>{step.title}</Text>}
          <View style={styles.stepContentWrap}>
            {renderContent ? (
              renderContent(step.content)
            ) : (
              <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                {step.content}
              </Markdown>
            )}
          </View>
        </Animated.View>

        <View style={styles.pagedFooter}>
          <View style={styles.footerLeft}>
          <ScrollView
            ref={dotsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={onDotsLayout}
            style={[
              styles.dotsScroll,
              { width: Math.min(steps.length, MAX_VISIBLE_DOTS) * DOT_STEP - DOT_GAP },
            ]}
            contentContainerStyle={styles.dotsScrollContent}
          >
            <View style={[styles.dotsRow, { width: steps.length * DOT_STEP - DOT_GAP }]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.activeHighlight,
                  {
                    left: (forward.current ? trailEdge : leadEdge).interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, DOT_STEP],
                    }),
                    width: Animated.add(
                      DOT_SIZE,
                      Animated.multiply(
                        Animated.subtract(forward.current ? leadEdge : trailEdge, forward.current ? trailEdge : leadEdge),
                        DOT_STEP,
                      ),
                    ),
                  },
                ]}
              />
              {steps.map((s, i) => {
                const numberColor = slideJs.interpolate({
                  inputRange: [i - 1, i, i + 1],
                  outputRange: [COLORS.textMuted, COLORS.primary, COLORS.textMuted],
                  extrapolate: 'clamp',
                });
                return (
                  <TouchableOpacity
                    key={`dot-${i}`}
                    style={[styles.dot, { left: i * DOT_STEP }]}
                    activeOpacity={0.7}
                    onPress={() => goTo(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to step ${s.stepNumber}`}
                    accessibilityState={{ selected: i === safeIndex }}
                  >
                    <Animated.Text style={[styles.dotText, { color: numberColor }]}>
                      {s.stepNumber}
                    </Animated.Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={onViewAll}
            activeOpacity={0.7}
            style={styles.viewAllBtn}
            accessibilityRole="button"
            accessibilityLabel="View all steps"
          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
          </View>

          <View style={styles.footerRight}>
          <TouchableOpacity
            onPress={() => goTo(safeIndex - 1)}
            disabled={isFirst}
            activeOpacity={0.7}
            style={[styles.navBtn, styles.navBtnGhost, isFirst && styles.navBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
          >
            <Text style={styles.navBtnGhostText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => goTo(safeIndex + 1)}
            disabled={isLast}
            activeOpacity={0.8}
            style={[styles.navBtn, styles.navBtnPrimary, isLast && styles.navBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Next step"
          >
            <Text style={styles.navBtnPrimaryText}>Next</Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    width: '100%',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.cardSecondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  stepsCountBadge: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.textMuted,
    backgroundColor: COLORS.card,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timelineBody: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: 12,
  },
  circleNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circleNodeText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  connectingLine: {
    width: 0,
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.borderDashed,
    borderStyle: 'dotted',
    marginVertical: 4,
    minHeight: 28,
  },
  contentColumn: {
    flex: 1,
    paddingBottom: 20,
  },
  contentColumnLast: {
    paddingBottom: 10,
  },
  stepTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: COLORS.text,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  stepContentWrap: {
    marginTop: 2,
  },
  viewToggleBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: 14,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewToggleText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.text,
  },
  pagedBody: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 6,
  },
  pagedTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.text,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  // Two rows: dots + View all on top, Back/Next full-width below. One row got
  // cramped once the headings moved to a wider font.
  pagedFooter: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  dotsScrollContent: {
    paddingVertical: 2,
  },
  dotsRow: {
    height: DOT_SIZE,
  },
  dot: {
    position: 'absolute',
    top: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
  },
  activeHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    zIndex: 1,
  },
  viewAllBtn: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryLight,
  },
  viewAllText: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  navBtnGhost: {
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnGhostText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: COLORS.text,
  },
  navBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  navBtnPrimaryText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: '#ffffff',
  },
});
