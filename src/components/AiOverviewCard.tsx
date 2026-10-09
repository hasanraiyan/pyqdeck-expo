import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Linking,
  Platform,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme/colors';
import { markdownRules } from '../theme/markdownStyles';
import { AiOverview, AiOverviewReference } from '../types';
import { NativeContentRenderer } from './NativeContentRenderer';
import { rf } from '../utils/responsive';
import { useDialogLayout } from '../utils/dialog';

/**
 * The generated answer above the search results.
 *
 * Collapsed to a few lines by default: the overview is a shortcut, not the
 * destination, and letting a 900-character paragraph push the actual papers
 * off-screen would invert that. "Show more" expands it.
 *
 * Citation markers are chips rather than raw "[1, 4]" text so they read as
 * tappable, and each one jumps straight to the question it came from.
 */

const COLLAPSED_LINES = 6;

// Collapsed height in px, derived from the body's own line height so the clip
// lands on a line boundary at any font scale. Applies as maxHeight because
// the body is block-level markdown now, not a single Text numberOfLines can
// clamp.
const COLLAPSED_H = rf(22) * COLLAPSED_LINES;

// Characters revealed per tick of the typewriter. One char per frame reads as
// a stall on an 800-character answer, so several go at once and the tick is
// slower than a frame - fewer setStates, same perceived speed.
const TYPE_CHARS_PER_TICK = 4;
const TYPE_TICK_MS = 16;

/** Three bars that pulse while the answer is being generated. */
const GeneratingState = () => {
  const anim = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(anim, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Feather name="zap" size={13} color={COLORS.primary} />
        <Text style={styles.headerLabel}>GENERATING…</Text>
      </View>
      {/* One shared value drives every bar - a timer per bar is how jank starts. */}
      <Animated.View style={{ opacity: anim }}>
        <View style={[styles.bone, { width: '100%' }]} />
        <View style={[styles.bone, { width: '96%' }]} />
        <View style={[styles.bone, { width: '72%' }]} />
      </Animated.View>
    </View>
  );
};

interface Props {
  overview: AiOverview | null;
  loading: boolean;
  onPressReference: (ref: AiOverviewReference) => void;
}

export const AiOverviewCard: React.FC<Props> = ({ overview, loading, onPressReference }) => {
  const dlg = useDialogLayout();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  // Which span's sources the sheet is showing; null keeps it closed.
  const [sheetRefs, setSheetRefs] = useState<AiOverviewReference[] | null>(null);

  // Citation spans are UTF-8 byte offsets, so the text is split on the byte
  // array and decoded per piece. Slicing the JS string directly would drift
  // the moment a summary contains a non-ASCII character.
  const segments = useMemo(() => {
    if (!overview?.text) return [];
    const { text, citations } = overview;
    if (!citations?.length) return [{ text, refs: [] as number[] }];

    // Hermes has not always shipped TextEncoder/TextDecoder. Where they are
    // missing, fall back to slicing the string directly - identical for the
    // ASCII summaries the model actually returns, and a wrong split beats a
    // crashed screen.
    const Enc = (globalThis as any).TextEncoder;
    const Dec = (globalThis as any).TextDecoder;
    if (!Enc || !Dec) {
      const out: { text: string; refs: number[] }[] = [];
      let at = 0;
      for (const c of [...citations].sort((a, b) => a.end - b.end)) {
        const end = Math.min(c.end, text.length);
        if (end <= at) continue;
        out.push({ text: text.slice(at, end), refs: c.refs });
        at = end;
      }
      if (at < text.length) out.push({ text: text.slice(at), refs: [] });
      return out;
    }

    const encoder = new Enc();
    const decoder = new Dec();
    const bytes = encoder.encode(text);

    const out: { text: string; refs: number[] }[] = [];
    let cursor = 0;
    for (const c of [...citations].sort((a, b) => a.end - b.end)) {
      const end = Math.min(c.end, bytes.length);
      if (end <= cursor) continue;
      out.push({ text: decoder.decode(bytes.slice(cursor, end)), refs: c.refs });
      cursor = end;
    }
    if (cursor < bytes.length) {
      out.push({ text: decoder.decode(bytes.slice(cursor)), refs: [] });
    }
    return out;
  }, [overview]);

  // Reveal the answer as it is "typed". Keyed on the text so a new query
  // restarts it, and cleared on unmount so a timer never outlives the screen.
  const fullText = overview?.text ?? '';
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!fullText) {
      setRevealed(0);
      return;
    }
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed((n) => {
        const next = n + TYPE_CHARS_PER_TICK;
        if (next >= fullText.length) {
          clearInterval(id);
          return fullText.length;
        }
        return next;
      });
    }, TYPE_TICK_MS);
    return () => clearInterval(id);
  }, [fullText]);

  // Expanding is a request to read it all, so stop teasing and show the rest.
  const finishTyping = () => setRevealed(fullText.length);

  if (loading) return <GeneratingState />;

  // No text is a normal outcome (the query was not summary-seeking), so the
  // card disappears rather than showing an empty or failed state.
  if (!overview?.enabled || !overview.text) return null;

  // Walk the segments and cut at the reveal point.
  const visible: { text: string; refs: number[] }[] = [];
  let budget = revealed;
  for (const seg of segments) {
    if (budget <= 0) break;
    if (budget >= seg.text.length) {
      visible.push(seg);
      budget -= seg.text.length;
    } else {
      visible.push({ text: seg.text.slice(0, budget), refs: [] });
      budget = 0;
    }
  }

  // One button for every source behind the answer - the sheet lists them all
  // and each row jumps to its question, paper or note.
  const openAllSources = () => {
    if (!overview.references.length) return;
    Haptics.selectionAsync().catch(() => {});
    setSheetRefs(overview.references);
  };

  const handleCopy = async () => {
    if (!overview?.text) return;
    try {
      await Clipboard.setStringAsync(overview.text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    if (!overview?.text) return;
    try {
      Haptics.selectionAsync().catch(() => {});
      await Share.share({
        message: overview.text,
        title: 'AI Overview',
      });
    } catch {}
  };

  // Plain http(s) links inside the summary stay tappable; everything else
  // renders as normal text.
  const overviewRules = {
    ...markdownRules,
    link: (node: any, children: any) => {
      const href: string = node.attributes?.href ?? '';
      if (/^https?:\/\//.test(href)) {
        return (
          <Text
            key={node.key}
            style={styles.extLink}
            onPress={() => Linking.openURL(href).catch(() => {})}
            suppressHighlighting
          >
            {children}
          </Text>
        );
      }
      return (
        <Text key={node.key} style={styles.extLink}>
          {children}
        </Text>
      );
    },
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Feather name="zap" size={13} color={COLORS.primary} />
        <Text style={styles.headerLabel}>AI OVERVIEW</Text>
        <Text style={styles.headerNote}>from past papers</Text>
      </View>

      {/* The summary is markdown with LaTeX, so each span renders through
          the same markdown+math pipeline as notes and solutions rather than
          as flat text. No inline chips - one Sources button below opens the
          slide-up sheet with every source. Slicing for the typewriter can
          briefly cut a markdown token in half; it resolves on the next tick. */}
      <View style={styles.contentWrapper}>
        <View style={!expanded ? styles.clippedContent : undefined}>
          {visible.map((seg, i) => (
            <NativeContentRenderer
              key={i}
              content={seg.text}
              fontSize={rf(14)}
              rules={overviewRules}
            />
          ))}
          {!expanded && (
            <View pointerEvents="none" style={styles.fadeContainer}>
              <Svg height="100%" width="100%">
                <Defs>
                  <SvgGradient id="cardFade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={COLORS.card} stopOpacity="0" />
                    <Stop offset="0.6" stopColor={COLORS.card} stopOpacity="0.85" />
                    <Stop offset="1" stopColor={COLORS.card} stopOpacity="1" />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardFade)" />
              </Svg>
            </View>
          )}
        </View>

        {!expanded && (
          <View style={styles.showMoreOverlay}>
            <TouchableOpacity
              style={styles.pillToggleBtn}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                finishTyping();
                setExpanded(true);
              }}
            >
              <Text style={styles.pillToggleText}>Show more</Text>
              <Feather name="chevron-down" size={15} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {expanded && (
        <View style={styles.expandedFooter}>
          {overview.references.length > 0 && (
            <TouchableOpacity
              style={styles.sourcesPill}
              activeOpacity={0.7}
              onPress={openAllSources}
            >
              <Feather name="link" size={13} color={COLORS.textMuted} />
              <Text style={styles.sourcesPillText}>Sources</Text>
            </TouchableOpacity>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              activeOpacity={0.6}
              onPress={handleCopy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={copied ? 'check' : 'copy'}
                size={16}
                color={copied ? COLORS.success : COLORS.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionIconBtn}
              activeOpacity={0.6}
              onPress={handleShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="more-vertical" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.showLessContainer}>
            <TouchableOpacity
              style={styles.pillToggleBtn}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setExpanded(false);
              }}
            >
              <Text style={styles.pillToggleText}>Show less</Text>
              <Feather name="chevron-up" size={15} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={sheetRefs !== null}
        transparent
        animationType={dlg.animationType}
        onRequestClose={() => setSheetRefs(null)}
      >
        <TouchableOpacity
          style={[styles.sheetBackdrop, dlg.overlay]}
          activeOpacity={1}
          onPress={() => setSheetRefs(null)}
        >
          {/* Swallows taps so a press inside the sheet does not dismiss it. */}
          <TouchableOpacity style={[styles.sheet, dlg.sheet]} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sources · {sheetRefs?.length ?? 0}</Text>

            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {(sheetRefs ?? []).map((ref) => {
                const metaText = (() => {
                  if (!ref.navigate) return null;
                  if (ref.navigate.target === 'topic') return 'STUDY NOTE';
                  const parts: string[] = [];
                  if (ref.navigate.semesterId) parts.push(ref.navigate.semesterId.toUpperCase());
                  if (ref.navigate.year) parts.push(String(ref.navigate.year));
                  if (ref.navigate.questionId) {
                    parts.push(ref.navigate.questionId);
                  } else {
                    parts.push('Full paper');
                  }
                  return parts.join(' · ');
                })();

                return (
                  <TouchableOpacity
                    key={ref.index}
                    style={styles.sourceRow}
                    activeOpacity={0.7}
                    disabled={!ref.navigate && !ref.url}
                    onPress={() => {
                      setSheetRefs(null);
                      Haptics.selectionAsync().catch(() => {});
                      onPressReference(ref);
                    }}
                  >
                    <View style={styles.sourceIcon}>
                      <Feather
                        name={
                          ref.navigate?.target === 'topic'
                            ? 'book-open'
                            : ref.navigate
                              ? 'file-text'
                              : 'globe'
                        }
                        size={13}
                        color={COLORS.secondary}
                      />
                    </View>
                    <View style={styles.sourceBody}>
                      <Text style={styles.sourceTitle} numberOfLines={3}>
                        {ref.title || 'Source'}
                      </Text>
                      {metaText ? (
                        <Text style={styles.sourceMeta}>{metaText}</Text>
                      ) : null}
                    </View>
                    {Boolean(ref.navigate || ref.url) ? (
                      <Feather name="chevron-right" size={16} color={COLORS.textSubtle} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetClose}
              activeOpacity={0.7}
              onPress={() => setSheetRefs(null)}
            >
              <Text style={styles.sheetCloseText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    // Same treatment as the question and note result cards, so the overview
    // reads as one of the results rather than a banner bolted above them.
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 16,
    ...SHADOWS.subtle,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(9.5),
    letterSpacing: 0.6,
    color: COLORS.primary,
  },
  headerNote: {
    fontFamily: FONTS.bodyMedium,
    fontSize: rf(9),
    color: COLORS.textSubtle,
    marginLeft: 'auto',
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: rf(14),
    lineHeight: rf(22),
    color: COLORS.text,
  },
  // Rendered inline inside <Text>, so only text-level props apply - no
  // padding, border radius or width. On Android a nested Text does honour
  // paddingHorizontal, which is what keeps the glyph off the background's
  // edge; iOS ignores it and relies on the letter-spacing instead.
  citation: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(10),
    color: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  extLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  contentWrapper: {
    position: 'relative',
  },
  clippedContent: {
    maxHeight: COLLAPSED_H,
    overflow: 'hidden',
    paddingBottom: 28,
  },
  fadeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  showMoreOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 28,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.card,
    ...SHADOWS.subtle,
  },
  pillToggleText: {
    fontFamily: FONTS.bodySemi,
    fontSize: rf(13),
    color: COLORS.primary,
  },
  expandedFooter: {
    marginTop: 12,
  },
  sourcesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  sourcesPillText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: rf(12),
    color: COLORS.text,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  actionIconBtn: {
    padding: 4,
  },
  showLessContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  bone: {
    height: 12,
    borderRadius: 4,
    backgroundColor: COLORS.cardSecondary,
    marginBottom: 8,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 48, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    // Capped so a span citing many papers still leaves the page behind visible.
    maxHeight: '70%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(11),
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  sheetList: {
    flexGrow: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.borderLight,
  },
  sourceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBody: {
    flex: 1,
    gap: 3,
  },
  sourceTitle: {
    fontFamily: FONTS.body,
    fontSize: rf(13),
    lineHeight: rf(18),
    color: COLORS.text,
  },
  sourceMeta: {
    fontFamily: FONTS.bodyMedium,
    fontSize: rf(9.5),
    color: COLORS.textSubtle,
  },
  sheetClose: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: COLORS.cardSecondary,
  },
  sheetCloseText: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(12),
    color: COLORS.textMuted,
  },
});
