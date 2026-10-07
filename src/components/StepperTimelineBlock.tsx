import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { solutionMarkdownStyles, markdownRules } from '../theme/markdownStyles';
import { StepperItem } from '../utils/stepperParser';

interface StepperTimelineBlockProps {
  steps: StepperItem[];
  renderContent?: (content: string) => React.ReactNode;
}

export const StepperTimelineBlock: React.FC<StepperTimelineBlockProps> = React.memo(({
  steps,
  renderContent,
}) => {
  if (!steps || steps.length === 0) return null;

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
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circleNodeText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
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
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  stepContentWrap: {
    marginTop: 2,
  },
});
