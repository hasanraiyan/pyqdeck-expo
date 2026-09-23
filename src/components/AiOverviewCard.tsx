import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { AiOverview, AiOverviewReference } from '../types';
import { NativeContentRenderer } from './NativeContentRenderer';
import { rf } from '../utils/responsive';

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
  const [expanded, setExpanded] = useState(false);
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

  const refByIndex = new Map(overview.references.map((r) => [r.index, r]));

  // Walk the segments and cut at the reveal point. A segment's citations are
  // withheld until its text is fully out, so a chip never precedes the
  // sentence it belongs to.
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

  const openSources = (refs: number[]) => {
    const list = refs.map((n) => refByIndex.get(n)).filter(Boolean) as AiOverviewReference[];
    if (!list.length) return;
    Haptics.selectionAsync().catch(() => {});
    setSheetRefs(list);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Feather name="zap" size={13} color={COLORS.primary} />
        <Text style={styles.headerLabel}>AI OVERVIEW</Text>
        <Text style={styles.headerNote}>from past papers</Text>
      </View>

      {/* The summary is markdown with LaTeX, so each cited span renders
          through the same markdown+math pipeline as notes and solutions
          rather than as flat text. A span's sources sit directly beneath it
          as a compact button - inline chips are not expressible inside
          rendered markdown. Slicing for the typewriter can briefly cut a
          markdown token in half; it resolves on the next tick. */}
      <View style={!expanded ? { maxHeight: COLLAPSED_H, overflow: 'hidden' } : undefined}>
        {visible.map((seg, i) => (
          <View key={i}>
            <NativeContentRenderer content={seg.text} fontSize={rf(14)} />
            {seg.refs.length > 0 && (
              <TouchableOpacity
                style={styles.sourcesBtn}
                activeOpacity={0.7}
                onPress={() => openSources(seg.refs)}
              >
                <Feather name="globe" size={11} color={COLORS.secondary} />
                <Text style={styles.sourcesBtnText}>
                  {seg.refs.length > 1 ? `${seg.refs.length} sources` : 'Source'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.toggle}
        activeOpacity={0.7}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          finishTyping();
          setExpanded((v) => !v);
        }}
      >
        <Text style={styles.toggleText}>{expanded ? 'Show less' : 'Show more'}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal
        visible={sheetRefs !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetRefs(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setSheetRefs(null)}
        >
          {/* Swallows taps so a press inside the sheet does not dismiss it. */}
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sources · {sheetRefs?.length ?? 0}</Text>

            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {(sheetRefs ?? []).map((ref) => (
                <TouchableOpacity
                  key={ref.index}
                  style={styles.sourceRow}
                  activeOpacity={0.7}
                  disabled={!ref.navigate}
                  onPress={() => {
                    setSheetRefs(null);
                    Haptics.selectionAsync().catch(() => {});
                    onPressReference(ref);
                  }}
                >
                  <View style={styles.sourceIcon}>
                    <Feather name="globe" size={13} color={COLORS.secondary} />
                  </View>
                  <View style={styles.sourceBody}>
                    <Text style={styles.sourceTitle} numberOfLines={3}>
                      {ref.title}
                    </Text>
                    {ref.navigate && (
                      <Text style={styles.sourceMeta}>
                        {ref.navigate.target === 'topic'
                          ? 'STUDY NOTE'
                          : ref.navigate.semesterId?.toUpperCase()}
                        {ref.navigate.year ? ` · ${ref.navigate.year}` : ''}
                        {ref.navigate.target === 'topic'
                          ? ''
                          : ref.navigate.questionId
                            ? ` · ${ref.navigate.questionId}`
                            : ' · Full paper'}
                      </Text>
                    )}
                  </View>
                  {ref.navigate && (
                    <Feather name="chevron-right" size={16} color={COLORS.textSubtle} />
                  )}
                </TouchableOpacity>
              ))}
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
    borderRadius: 4,
    padding: 14,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerLabel: {
    fontFamily: FONTS.mono,
    fontSize: rf(9.5),
    fontWeight: '700',
    letterSpacing: 0.6,
    color: COLORS.primary,
  },
  headerNote: {
    fontFamily: FONTS.mono,
    fontSize: rf(9),
    color: COLORS.textSubtle,
    marginLeft: 'auto',
  },
  body: {
    fontFamily: FONTS.serif,
    fontSize: rf(14),
    lineHeight: rf(22),
    color: COLORS.text,
  },
  // Rendered inline inside <Text>, so only text-level props apply - no
  // padding, border radius or width. On Android a nested Text does honour
  // paddingHorizontal, which is what keeps the glyph off the background's
  // edge; iOS ignores it and relies on the letter-spacing instead.
  citation: {
    fontFamily: FONTS.mono,
    fontSize: rf(10),
    fontWeight: '700',
    color: COLORS.secondary,
    backgroundColor: COLORS.secondaryLight,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: COLORS.primaryLight,
  },
  toggleText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    color: COLORS.primary,
  },
  // Per-span sources button: compact so a much-cited answer does not become
  // a stack of banners, but a real row (not an inline chip) because rendered
  // markdown cannot host inline tappables.
  sourcesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: COLORS.secondaryLight,
  },
  sourcesBtnText: {
    fontFamily: FONTS.mono,
    fontSize: rf(10.5),
    fontWeight: '700',
    color: COLORS.secondary,
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
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
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
    fontFamily: FONTS.sans,
    fontSize: rf(13),
    lineHeight: rf(18),
    color: COLORS.text,
  },
  sourceMeta: {
    fontFamily: FONTS.mono,
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
    fontFamily: FONTS.mono,
    fontSize: rf(12),
    fontWeight: '700',
    color: COLORS.textMuted,
  },
});
