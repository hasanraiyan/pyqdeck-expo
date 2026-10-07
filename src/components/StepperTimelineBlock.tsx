import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { StepperItem } from '../utils/stepperParser';

interface StepperTimelineBlockProps {
  steps: StepperItem[];
}

export const StepperTimelineBlock: React.FC<StepperTimelineBlockProps> = React.memo(({ steps }) => {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  if (!steps || steps.length === 0) return null;

  const handleStepPress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveStep((curr) => (curr === index ? null : index));
  };

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
            const isActive = activeStep === index;

            return (
              <View key={`step-${index}`} style={styles.stepRow}>
                {/* Left Timeline Column (Node Circle + Connecting Vertical Line) */}
                <View style={styles.nodeColumn}>
                  <TouchableOpacity
                    style={[
                      styles.circleNode,
                      isActive && styles.circleNodeActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => handleStepPress(index)}
                    accessibilityLabel={`Step ${step.stepNumber}: ${step.title || ''}`}
                  >
                    <Text
                      style={[
                        styles.circleNodeText,
                        isActive && styles.circleNodeTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {step.stepNumber}
                    </Text>
                  </TouchableOpacity>

                  {!isLast && <View style={styles.connectingLine} />}
                </View>

                {/* Right Content Column */}
                <TouchableOpacity
                  style={[
                    styles.contentColumn,
                    isActive && styles.contentColumnActive,
                    isLast && styles.contentColumnLast,
                  ]}
                  activeOpacity={0.9}
                  onPress={() => handleStepPress(index)}
                >
                  {Boolean(step.title) && (
                    <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>
                      {step.title}
                    </Text>
                  )}

                  <View style={styles.stepContentWrap}>
                    <Markdown style={solutionMarkdownStyles} rules={markdownRules}>
                      {step.content}
                    </Markdown>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
});

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
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  stepsCountBadge: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: '700',
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
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circleNodeActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  circleNodeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  circleNodeTextActive: {
    color: '#ffffff',
  },
  connectingLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
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
  contentColumnActive: {
    backgroundColor: 'rgba(178, 58, 46, 0.03)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
  },
  stepTitle: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  stepTitleActive: {
    color: COLORS.primary,
  },
  stepContentWrap: {
    marginTop: 2,
  },
});
