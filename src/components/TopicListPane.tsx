import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { rf } from '../utils/responsive';

export type TopicEntry = { id: string; title: string; moduleId: string; moduleName: string };

type Row =
  | { kind: 'module'; key: string; title: string }
  | { kind: 'topic'; key: string; entry: TopicEntry };

interface Props {
  entries: TopicEntry[];
  selectedId?: string;
  title?: string;
  width: number;
  onSelect: (entry: TopicEntry) => void;
}

/**
 * Left pane of the two-pane notes view (FR-L4): the subject's topics that
 * have notes, grouped by module, with the open one highlighted (FR-L8).
 * Like QuestionListPane it only lists and selects; TopicNotesScreen owns what
 * selecting does, so it is exactly the Prev / Next path.
 */
export function TopicListPane({ entries, selectedId, title, width, onSelect }: Props) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastModule: string | undefined;
    for (const entry of entries) {
      if (entry.moduleId !== lastModule) {
        lastModule = entry.moduleId;
        out.push({ kind: 'module', key: `m:${entry.moduleId}`, title: entry.moduleName });
      }
      out.push({ kind: 'topic', key: `t:${entry.moduleId}:${entry.id}`, entry });
    }
    return out;
  }, [entries]);

  const listRef = useRef<FlatList<Row>>(null);
  const visibleKeys = useRef<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Row }[] }) => {
      visibleKeys.current = new Set(viewableItems.map((v) => v.item.key));
    }
  ).current;

  // Same rule as QuestionListPane: follow the open topic only when it is off
  // screen, so tapping a visible row never moves the list.
  const index = rows.findIndex((r) => r.kind === 'topic' && r.entry.id === selectedId);
  useEffect(() => {
    if (index < 0 || visibleKeys.current.has(rows[index].key)) return;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: false });
  }, [index, rows]);

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.35, animated: false });
      }, 100);
    },
    []
  );

  return (
    <View style={[styles.pane, { width, minWidth: width, maxWidth: width }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {title || 'Topics'}
        </Text>
        <Text style={styles.headerCount}>{entries.length} topics with notes</Text>
      </View>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(r) => r.key}
        extraData={selectedId}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onScrollToIndexFailed={onScrollToIndexFailed}
        renderItem={({ item }) => {
          if (item.kind === 'module') {
            return (
              <Text style={styles.moduleHeading} numberOfLines={2}>
                {item.title}
              </Text>
            );
          }
          const selected = item.entry.id === selectedId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) {
                  Haptics.selectionAsync();
                  onSelect(item.entry);
                }
              }}
              style={({ pressed, hovered }: any) => [
                styles.row,
                selected && styles.rowSelected,
                !selected && (pressed || hovered) && styles.rowHover,
              ]}
            >
              <Text style={[styles.topic, selected && styles.topicSelected]} numberOfLines={3}>
                {item.entry.title}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.serif, fontSize: rf(18), color: COLORS.text },
  headerCount: { marginTop: 2, fontSize: rf(11), color: COLORS.textMuted },
  moduleHeading: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
    backgroundColor: COLORS.background,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowSelected: { backgroundColor: COLORS.background, borderLeftColor: COLORS.primary },
  rowHover: { backgroundColor: COLORS.background },
  topic: { fontSize: rf(13.5), lineHeight: rf(19), color: COLORS.text },
  topicSelected: { color: COLORS.primary, fontWeight: '600' },
});
