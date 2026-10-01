import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../theme/colors';
import { rf } from '../utils/responsive';
import { usePaneCollapsed } from '../utils/paneState';
import { PaneFrame, PaneIconButton } from './PaneFrame';

export type TopicEntry = { id: string; title: string; moduleId: string; moduleName: string };

type Row =
  | { kind: 'module'; key: string; moduleId: string; title: string; count: number; open: boolean }
  | { kind: 'topic'; key: string; entry: TopicEntry };

interface Props {
  entries: TopicEntry[];
  selectedId?: string;
  title?: string;
  width: number;
  onSelect: (entry: TopicEntry) => void;
}

/**
 * Left pane of the two-pane notes view (FR-L4): the subject's topics grouped by
 * module, each module folds open and shut, and the whole pane folds sideways
 * (PaneFrame). The open topic is highlighted (FR-L8) and its module is kept
 * open. Like QuestionListPane it only lists and selects; TopicNotesScreen owns
 * what selecting does, so it is exactly the Prev / Next path.
 */
export function TopicListPane({ entries, selectedId, title, width, onSelect }: Props) {
  const [collapsed, setCollapsed] = usePaneCollapsed();

  const modules = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const e of entries) {
      if (!seen.has(e.moduleId)) {
        seen.add(e.moduleId);
        order.push(e.moduleId);
      }
    }
    return order;
  }, [entries]);

  const selectedModule = entries.find((e) => e.id === selectedId)?.moduleId;
  // Only the open topic's module starts open: 50 topics folded into a handful
  // of modules is far easier to scan than one long list.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(selectedModule ? [selectedModule] : [])
  );
  // Reaching a topic in a folded module (Prev / Next, a deep link) opens it.
  useEffect(() => {
    if (!selectedModule) return;
    setOpen((prev) => (prev.has(selectedModule) ? prev : new Set(prev).add(selectedModule)));
  }, [selectedModule, selectedId]);

  const allOpen = modules.length > 0 && modules.every((m) => open.has(m));
  const toggleModule = useCallback((id: string) => {
    Haptics.selectionAsync();
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastModule: string | undefined;
    for (const entry of entries) {
      const isOpen = open.has(entry.moduleId);
      if (entry.moduleId !== lastModule) {
        lastModule = entry.moduleId;
        out.push({
          kind: 'module',
          key: `m:${entry.moduleId}`,
          moduleId: entry.moduleId,
          title: entry.moduleName,
          count: entries.filter((e) => e.moduleId === entry.moduleId).length,
          open: isOpen,
        });
      }
      if (isOpen) out.push({ kind: 'topic', key: `t:${entry.moduleId}:${entry.id}`, entry });
    }
    return out;
  }, [entries, open]);

  const listRef = useRef<FlatList<Row>>(null);
  const visibleKeys = useRef<Set<string>>(new Set());
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: Row }[] }) => {
      visibleKeys.current = new Set(viewableItems.map((v) => v.item.key));
    }
  ).current;

  // Follow the open topic only when it is off screen, so tapping a visible row
  // never moves the list.
  const index = rows.findIndex((r) => r.kind === 'topic' && r.entry.id === selectedId);
  useEffect(() => {
    if (index < 0 || visibleKeys.current.has(rows[index].key)) return;
    listRef.current?.scrollToIndex({ index, viewPosition: 0.35, animated: false });
  }, [index, selectedId]);

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
    <PaneFrame
      width={width}
      title={title || 'Topics'}
      subtitle={`${entries.length} topics with notes · ${modules.length} modules`}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed(!collapsed)}
      actions={
        <PaneIconButton
          icon={allOpen ? 'chevrons-up' : 'chevrons-down'}
          label={allOpen ? 'Collapse all modules' : 'Expand all modules'}
          onPress={() => setOpen(allOpen ? new Set() : new Set(modules))}
        />
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
          if (item.kind === 'module') {
            return (
              <Pressable
                accessibilityRole="button"
                aria-expanded={item.open}
                onPress={() => toggleModule(item.moduleId)}
                style={({ pressed, hovered }: any) => [
                  styles.moduleRow,
                  (pressed || hovered) && styles.moduleRowHover,
                ]}
              >
                <Feather
                  name={item.open ? 'chevron-down' : 'chevron-right'}
                  size={15}
                  color={COLORS.textMuted}
                />
                <Text style={styles.moduleHeading} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.moduleCount}>{item.count}</Text>
              </Pressable>
            );
          }
          const selected = item.entry.id === selectedId;
          return (
            <Pressable
              accessibilityRole="button"
              aria-selected={selected}
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
    </PaneFrame>
  );
}

const styles = StyleSheet.create({
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  moduleRowHover: { backgroundColor: COLORS.border },
  moduleHeading: {
    flex: 1,
    fontSize: rf(11),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  moduleCount: { fontSize: rf(11), color: COLORS.textSubtle },
  row: {
    paddingLeft: 32,
    paddingRight: 16,
    paddingVertical: 10,
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
