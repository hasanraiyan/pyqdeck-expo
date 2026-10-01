import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { QuestionSummary } from '../types';
import { COLORS } from '../theme/colors';
import { rf } from '../utils/responsive';
import { usePaneCollapsed } from '../utils/paneState';
import { PaneFrame, PaneIconButton } from './PaneFrame';

type Row =
  | { kind: 'group'; key: string; groupId: string; title: string; count: number; open: boolean }
  | { kind: 'question'; key: string; q: QuestionSummary };

interface Props {
  questions: QuestionSummary[];
  selectedId?: string;
  year?: number | string;
  width: number;
  onSelect: (q: QuestionSummary) => void;
}

const NO_MODULE = '—';
const groupOf = (q: QuestionSummary) => (q.chapter && q.chapter.trim()) || NO_MODULE;

/**
 * Left pane of the two-pane question view (FR-L3): the questions of the paper
 * being read, with the open one highlighted (FR-L8). It folds sideways
 * (PaneFrame) and can group by module, each module folding open and shut. It
 * only lists and selects; the detail screen owns what selecting does, so ads,
 * scroll reset and state resets behave exactly as they do for Prev / Next.
 *
 * Grouping is off by default: Prev / Next walk the paper in order, and
 * grouping by module reorders questions that interleave modules.
 */
export function QuestionListPane({ questions, selectedId, year, width, onSelect }: Props) {
  const [collapsed, setCollapsed] = usePaneCollapsed();
  const [grouped, setGrouped] = useState(false);

  const groups = useMemo(() => {
    const order: string[] = [];
    for (const q of questions) {
      const g = groupOf(q);
      if (!order.includes(g)) order.push(g);
    }
    return order;
  }, [questions]);

  const selectedGroup = useMemo(() => {
    const q = questions.find((x) => x.questionId === selectedId);
    return q ? groupOf(q) : undefined;
  }, [questions, selectedId]);

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(selectedGroup ? [selectedGroup] : [])
  );
  // The open question's module is always kept open.
  useEffect(() => {
    if (!selectedGroup) return;
    setOpen((prev) => (prev.has(selectedGroup) ? prev : new Set(prev).add(selectedGroup)));
  }, [selectedGroup, selectedId]);

  const allOpen = groups.length > 0 && groups.every((g) => open.has(g));
  const toggleGroup = useCallback((id: string) => {
    Haptics.selectionAsync();
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!grouped) {
      return questions.map((q) => ({ kind: 'question' as const, key: q.questionId, q }));
    }
    const out: Row[] = [];
    for (const g of groups) {
      const inGroup = questions.filter((q) => groupOf(q) === g);
      const isOpen = open.has(g);
      out.push({ kind: 'group', key: `g:${g}`, groupId: g, title: g, count: inGroup.length, open: isOpen });
      if (isOpen) for (const q of inGroup) out.push({ kind: 'question', key: q.questionId, q });
    }
    return out;
  }, [grouped, groups, open, questions]);

  const listRef = useRef<FlatList<Row>>(null);
  const visibleKeys = useRef<Set<string>>(new Set());
  // FlatList wants these stable for the lifetime of the list.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Row }[] }) => {
      visibleKeys.current = new Set(viewableItems.map((v) => v.item.key));
    }
  ).current;

  // Bring the open question into view when it isn't (opened by deep link, or
  // reached with Prev / Next). Skipped when it is already visible, so tapping a
  // row you can see never makes the list jump under the pointer.
  const index = rows.findIndex((r) => r.kind === 'question' && r.q.questionId === selectedId);
  useEffect(() => {
    if (index < 0 || visibleKeys.current.has(rows[index].key)) return;
    // Rows differ in height, so this can fail before they are measured; the
    // fallback in onScrollToIndexFailed retries once they are.
    listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: false });
  }, [index, selectedId]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.35, animated: false });
      }, 100);
    },
    []
  );

  const showGrouping = groups.length > 1 || (groups.length === 1 && groups[0] !== NO_MODULE);

  return (
    <PaneFrame
      width={width}
      title={year ? `Paper ${year}` : 'Questions'}
      subtitle={`${questions.length} questions${grouped ? ` · ${groups.length} modules` : ''}`}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(!collapsed)}
      actions={
        showGrouping ? (
          <>
            {grouped && (
              <PaneIconButton
                icon={allOpen ? 'chevrons-up' : 'chevrons-down'}
                label={allOpen ? 'Collapse all modules' : 'Expand all modules'}
                onPress={() => setOpen(allOpen ? new Set() : new Set(groups))}
              />
            )}
            <PaneIconButton
              icon="layers"
              label={grouped ? 'Show in paper order' : 'Group by module'}
              active={grouped}
              onPress={() => setGrouped((g) => !g)}
            />
          </>
        ) : undefined
      }
    >
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        extraData={selectedId}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={onScrollToIndexFailed}
        renderItem={({ item }) => {
          if (item.kind === 'group') {
            return (
              <Pressable
                accessibilityRole="button"
                aria-expanded={item.open}
                onPress={() => toggleGroup(item.groupId)}
                style={({ pressed, hovered }: any) => [
                  styles.groupRow,
                  (pressed || hovered) && styles.groupRowHover,
                ]}
              >
                <Feather
                  name={item.open ? 'chevron-down' : 'chevron-right'}
                  size={15}
                  color={COLORS.textMuted}
                />
                <Text style={styles.groupHeading} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.groupCount}>{item.count}</Text>
              </Pressable>
            );
          }
          const q = item.q;
          const selected = q.questionId === selectedId;
          const label = String(q.qNumber).startsWith('Q') ? q.qNumber : `Q${q.qNumber}`;
          return (
            <Pressable
              accessibilityRole="button"
              aria-selected={selected}
              onPress={() => {
                if (!selected) {
                  Haptics.selectionAsync();
                  onSelect(q);
                }
              }}
              style={({ pressed, hovered }: any) => [
                styles.row,
                selected && styles.rowSelected,
                !selected && (pressed || hovered) && styles.rowHover,
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.qNum, selected && styles.qNumSelected]}>{label}</Text>
                <View style={styles.meta}>
                  {q.hasSolution ? (
                    <Feather name="check-circle" size={12} color={COLORS.primary} />
                  ) : null}
                  {q.marks ? <Text style={styles.marks}>{q.marks} marks</Text> : null}
                </View>
              </View>
              <Text style={styles.preview} numberOfLines={2}>
                {q.textPreview || q.text}
              </Text>
            </Pressable>
          );
        }}
      />
    </PaneFrame>
  );
}

const styles = StyleSheet.create({
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  groupRowHover: { backgroundColor: COLORS.border },
  groupHeading: {
    flex: 1,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  groupCount: { fontSize: rf(11), color: COLORS.textSubtle },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowSelected: { backgroundColor: COLORS.background, borderLeftColor: COLORS.primary },
  rowHover: { backgroundColor: COLORS.background },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  qNum: { fontSize: rf(12), fontWeight: '700', color: COLORS.textMuted },
  qNumSelected: { color: COLORS.primary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  marks: { fontSize: rf(11), color: COLORS.textMuted },
  preview: { fontSize: rf(13), lineHeight: rf(19), color: COLORS.text },
});
