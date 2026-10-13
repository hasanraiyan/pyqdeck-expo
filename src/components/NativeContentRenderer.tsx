import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS } from '../theme/colors';
import { questionMarkdownStyles, solutionMarkdownStyles, markdownRules, markdownParser } from '../theme/markdownStyles';
import { parseContentBlocks, ContentBlock } from '../utils/nativeContentParser';
import { NativeMathView } from './NativeMathView';
import { NativeCodeBlock } from './NativeCodeBlock';
import { MermaidBlock } from './MermaidBlock';
import { CalloutCard } from './CalloutCard';
import { TabbedCodeBlock } from './TabbedCodeBlock';
import { ImageGalleryBlock } from './ImageGalleryBlock';
import { YouTubeCard } from './YouTubeCard';
import { DetailsSpoilerBlock } from './DetailsSpoilerBlock';
import { StepperTimelineBlock } from './StepperTimelineBlock';
import { SvgDiagramBlock } from './SvgDiagramBlock';
import { cleanMarkdown } from '../utils/responsive';
import { ContentErrorBoundary } from './ContentErrorBoundary';
import { enqueueHeavy, holdHeavyQueue } from '../utils/heavyQueue';

export interface NativeContentRendererProps {
  content?: string | null;
  html?: string | null;
  fontSize?: number;
  textColor?: string;
  variant?: 'question' | 'solution';
  markdownStyles?: any;
  /** Override the markdown render rules (defaults to the shared set). */
  rules?: any;
  style?: StyleProp<ViewStyle>;
  /**
   * Mount the blocks a few at a time from the top instead of all at once, so a
   * long note shows its first text quickly instead of freezing the JS thread.
   */
  progressive?: boolean;
}

export const NativeContentRenderer: React.FC<NativeContentRendererProps> = React.memo(
  ({
    content,
    fontSize = 16,
    textColor = COLORS.text,
    variant = 'question',
    markdownStyles,
    rules = markdownRules,
    style,
    progressive = false,
  }) => {
    const blocks = useMemo(() => {
      if (!content || content.trim().length === 0) return [];
      try {
        return parseContentBlocks(content);
      } catch {
        return [{ type: 'markdown', content } as ContentBlock];
      }
    }, [content]);

    const units = useMemo(
      () => (progressive ? splitForProgressive(blocks) : blocks),
      [blocks, progressive]
    );

    const [revealed, setRevealed] = useState(INITIAL_UNITS);
    const unitsRef = useRef(units);
    useEffect(() => {
      if (unitsRef.current !== units) {
        unitsRef.current = units;
        setRevealed(INITIAL_UNITS);
      }
    }, [units]);

    const done = !progressive || revealed >= units.length;

    // Hold the diagram queue only until the first screenful of text is up, then
    // let diagrams draw (top to bottom) while the rest of the text keeps
    // arriving, so the diagrams near the top do not wait for the whole note.
    const textReady = useMemo(() => {
      if (!progressive) return true;
      let spent = 0;
      for (let i = 0; i < Math.min(revealed, units.length); i++) spent += blockCost(units[i]);
      return spent >= HEAVY_AFTER_COST || revealed >= units.length;
    }, [progressive, units, revealed]);
    useEffect(() => {
      if (!progressive || textReady) return;
      return holdHeavyQueue();
    }, [progressive, textReady]);
    useEffect(() => {
      if (!progressive || done) return;
      const t = setTimeout(
        () => setRevealed((n) => n + unitsForNextStep(units, n)),
        REVEAL_GAP_MS
      );
      return () => clearTimeout(t);
    }, [progressive, done, revealed]);

    const mdStyles =
      markdownStyles || (variant === 'solution' ? solutionMarkdownStyles : questionMarkdownStyles);

    const renderNested = useCallback(
      (innerContent: string) => (
        <NativeContentRenderer
          content={innerContent}
          fontSize={fontSize}
          textColor={textColor}
          variant={variant}
          markdownStyles={markdownStyles}
          rules={rules}
        />
      ),
      [fontSize, textColor, variant, markdownStyles, rules]
    );

    if (!blocks || blocks.length === 0) {
      return null;
    }

    const visible = progressive ? units.slice(0, revealed) : units;

    return (
      <View style={[styles.container, style]}>
        {visible.map((block: ContentBlock, index: number) => (
          <BlockView
            key={`${block.type}-${index}`}
            block={block}
            fontSize={fontSize}
            textColor={textColor}
            mdStyles={mdStyles}
            rules={rules}
            renderNested={renderNested}
            deferHeavy={progressive}
          />
        ))}
      </View>
    );
  }
);

const INITIAL_UNITS = 2;
// Long markdown is cut into pieces of about this many characters (at paragraph
// or heading boundaries), so no single step has to render a big wall of text.
const CHUNK_TARGET_CHARS = 500;
const CHUNK_SPLIT_ABOVE_CHARS = 800;
// Pause between reveal steps so taps and animations get a turn on the JS thread.
const REVEAL_GAP_MS = 16;
const MATH_PLACEHOLDER_HEIGHT = 44;
// Rough cost of mounting a block, in "characters of markdown". Each reveal step
// adds blocks until it has spent STEP_BUDGET, so many tiny pieces go in together
// while one big piece still gets a step to itself.
const STEP_BUDGET = 800;
const BLOCK_BASE_COST = 250;
// Diagrams may start drawing once this much (by the same cost) is on screen.
const HEAVY_AFTER_COST = 3000;

function blockCost(block: ContentBlock): number {
  if (block.type === 'markdown') return BLOCK_BASE_COST + block.content.length;
  if (block.type === 'code') return BLOCK_BASE_COST + block.code.length;
  return 400; // diagram / math / callout placeholders and the like
}

function unitsForNextStep(units: ContentBlock[], from: number): number {
  let spent = 0;
  let count = 0;
  for (let i = from; i < units.length; i++) {
    const cost = blockCost(units[i]);
    if (count > 0 && spent + cost > STEP_BUDGET) break;
    spent += cost;
    count++;
  }
  return Math.max(1, count);
}

/**
 * A paragraph that belongs to a list, table or quote must stay with its
 * neighbours (splitting would restart numbering or break the table).
 */
function isStructural(paragraph: string): boolean {
  return /^\s*([-*+>|]|\d+[.)])(\s|$)/.test(paragraph) || /^\s*</.test(paragraph);
}

/**
 * Splits long markdown blocks at headings and plain paragraph breaks into
 * pieces of about CHUNK_TARGET_CHARS, so they can be revealed one at a time.
 * Code, math and diagrams are already separate blocks.
 */
function splitForProgressive(blocks: ContentBlock[]): ContentBlock[] {
  const out: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type !== 'markdown' || block.content.length < CHUNK_SPLIT_ABOVE_CHARS) {
      out.push(block);
      continue;
    }
    const paragraphs = block.content.split(/\n\s*\n|\n(?=#{1,4}[ \t]+\S)/);
    let acc = '';
    let prev = '';
    for (const para of paragraphs) {
      const canSplit =
        acc.length >= CHUNK_TARGET_CHARS &&
        (/^#{1,4}[ \t]/.test(para) || (!isStructural(prev) && !isStructural(para)));
      if (canSplit) {
        out.push({ type: 'markdown', content: acc });
        acc = '';
      }
      acc = acc ? acc + '\n\n' + para : para;
      prev = para;
    }
    if (acc) out.push({ type: 'markdown', content: acc });
  }
  return out;
}

/**
 * Display math is expensive to draw, so in progressive mode it waits its turn in
 * the heavy queue (after the text, in note order, one at a time) behind a small
 * placeholder bar.
 */
const DeferredMath: React.FC<{ math: string; fontSize: number; color: string }> = ({
  math,
  fontSize,
  color,
}) => {
  const [ready, setReady] = useState(false);
  useEffect(
    () =>
      enqueueHeavy(
        () =>
          new Promise<void>((resolve) => {
            setReady(true);
            // The draw commits (and blocks) before this timer fires.
            setTimeout(resolve, 16);
          })
      ),
    []
  );
  if (!ready) {
    return (
      <View style={{ height: MATH_PLACEHOLDER_HEIGHT, marginVertical: 10, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '45%', height: 10, borderRadius: 5, backgroundColor: COLORS.border, opacity: 0.5 }} />
      </View>
    );
  }
  return <NativeMathView math={math} displayMode={true} fontSize={fontSize} color={color} />;
};

interface BlockViewProps {
  block: ContentBlock;
  fontSize: number;
  textColor: string;
  mdStyles: any;
  rules: any;
  renderNested: (content: string) => React.ReactElement;
  deferHeavy?: boolean;
}

// Memoised so revealing the next block does not re-render the ones already shown.
const BlockView: React.FC<BlockViewProps> = React.memo(
  ({ block, fontSize, textColor, mdStyles, rules, renderNested, deferHeavy }) => {
    const index = 0;
          if (block.type === 'mermaid') {
            return (
              <ContentErrorBoundary key={`mermaid-${index}`} fallbackText={block.code}>
                <MermaidBlock code={block.code} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'svg') {
            return (
              <ContentErrorBoundary key={`svg-${index}`} fallbackText={block.xml}>
                <SvgDiagramBlock
                  xml={block.xml}
                  title={block.title}
                  aspectRatio={block.aspectRatio}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'code') {
            return (
              <ContentErrorBoundary key={`code-${index}`} fallbackText={block.code}>
                <NativeCodeBlock code={block.code} language={block.language} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'code_tabs') {
            return (
              <ContentErrorBoundary key={`code-tabs-${index}`}>
                <TabbedCodeBlock tabs={block.tabs} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'display_math') {
            return (
              <ContentErrorBoundary key={`math-${index}`} fallbackText={block.math}>
                {deferHeavy ? (
                  <DeferredMath math={block.math} fontSize={fontSize} color={textColor} />
                ) : (
                  <NativeMathView
                    math={block.math}
                    displayMode={true}
                    fontSize={fontSize}
                    color={textColor}
                  />
                )}
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'callout') {
            return (
              <ContentErrorBoundary key={`callout-${index}`} fallbackText={block.content}>
                <CalloutCard
                  type={block.calloutType}
                  title={block.title}
                  content={block.content}
                  rules={rules}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'image_gallery') {
            return (
              <ContentErrorBoundary key={`gallery-${index}`}>
                <ImageGalleryBlock images={block.images} />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'youtube') {
            return (
              <ContentErrorBoundary key={`yt-${index}`}>
                <YouTubeCard
                  videoId={block.videoId}
                  title={block.title}
                  url={block.url}
                  startTime={block.startTime}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'details') {
            return (
              <ContentErrorBoundary key={`details-${index}`}>
                <DetailsSpoilerBlock
                  summary={block.summary}
                  content={block.content}
                  defaultOpen={block.defaultOpen}
                  renderContent={renderNested}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'stepper') {
            return (
              <ContentErrorBoundary key={`stepper-${index}`}>
                <StepperTimelineBlock
                  steps={block.steps}
                  renderContent={renderNested}
                />
              </ContentErrorBoundary>
            );
          }

          if (block.type === 'markdown') {
            return (
              <View key={`md-${index}`} style={styles.markdownBlock}>
                <ContentErrorBoundary fallbackText={block.content}>
                  <Markdown markdownit={markdownParser} style={mdStyles} rules={rules}>
                    {cleanMarkdown(block.content)}
                  </Markdown>
                </ContentErrorBoundary>
              </View>
            );
          }

          return null;

  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  markdownBlock: {
    width: '100%',
  },
});
