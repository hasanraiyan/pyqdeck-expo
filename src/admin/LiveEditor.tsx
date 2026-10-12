import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS } from '../theme/colors';
import { NativeContentRenderer } from '../components/NativeContentRenderer';
import { highlight, type Flags } from './mdHighlight';
import { type Block, type ToolSpec, insertTool, joinBlocks, pruneEmptyBlocks, splitBlocks } from './markdownEdit';

/**
 * Live editing: the note is shown the way students see it, block by block
 * (paragraph, heading, formula, diagram, code ...). Tap a block and just that
 * block turns into a small markdown input; the rest stays rendered. Typing only
 * ever touches one short input, so it stays fast on long notes.
 *
 * The text is the single source of truth: blocks are a view of it
 * (markdownEdit.splitBlocks), and joining them gives back the exact text.
 */

export interface LiveEditorHandle {
  /** Apply a toolbar snippet to the block being edited (or the last block). */
  apply: (tool: ToolSpec) => void;
}

type Sel = { start: number; end: number };

const SIZES = { 1: 24, 2: 20, 3: 17.5 } as const;

function spanStyle(f: Flags) {
  return {
    ...(f.bold ? { fontFamily: FONTS.bodyBold } : null),
    ...(f.italic ? { fontStyle: 'italic' as const } : null),
    ...(f.strike ? { textDecorationLine: 'line-through' as const } : null),
    ...(f.mono ? { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 14 } : null),
    ...(f.size ? { fontSize: SIZES[f.size] } : null),
    ...(f.muted ? { color: COLORS.textMuted } : null),
    ...(f.accent ? { color: COLORS.primary } : null),
    // Last, so faded markers stay faint inside bold, math or headings.
    ...(f.dim ? { color: COLORS.textSubtle, fontFamily: f.mono ? undefined : FONTS.body, fontWeight: 'normal' as const } : null),
  };
}

// Blocks whose result cannot be seen in the styled text itself: math, diagrams, code, HTML-ish, callouts, images.
const NEEDS_PREVIEW = /\$|```|<\w|^:::|^>\s*\[!|!\[|\\\[|\\begin/m;

/** The block as students will see it, refreshed shortly after typing stops. */
const LivePreview = memo(function LivePreview({ text, renderBlock }: { text: string; renderBlock?: (text: string) => React.ReactNode }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const id = setTimeout(() => setShown(text), 350);
    return () => clearTimeout(id);
  }, [text]);
  if (shown.trim() === '') return null;
  return (
    <View style={s.preview} pointerEvents="none">
      <Text style={s.previewKicker}>LIVE PREVIEW</Text>
      {renderBlock ? renderBlock(shown) : <NativeContentRenderer content={shown} fontSize={15} />}
    </View>
  );
});

const RenderedBlock = memo(function RenderedBlock({
  text,
  index,
  onActivate,
  onLayoutY,
  renderBlock,
}: {
  text: string;
  index: number;
  onActivate: (i: number) => void;
  onLayoutY: (i: number, y: number) => void;
  renderBlock?: (text: string) => React.ReactNode;
}) {
  if (text.trim() === '') return null;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => onActivate(index)}
      onLayout={(e) => onLayoutY(index, e.nativeEvent.layout.y)}
      style={s.block}
      accessibilityLabel="Edit this block"
    >
      {/* Taps belong to the block, not to links or diagrams inside it. */}
      <View pointerEvents="none">{renderBlock ? renderBlock(text) : <NativeContentRenderer content={text} fontSize={15} />}</View>
    </TouchableOpacity>
  );
});

export const LiveEditor = forwardRef<
  LiveEditorHandle,
  {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    placeholder?: string;
    /** Custom rendering of one inactive block (defaults to the student renderer). */
    renderBlock?: (text: string) => React.ReactNode;
  }
>(function LiveEditor({ value, onChange, disabled, placeholder, renderBlock }, ref) {
  const [blocks, setBlocks] = useState<Block[]>(() => splitBlocks(value));
  const [active, setActive] = useState<number | null>(null);
  // Caret for the render right after a block opens or a snippet is inserted.
  const [initSel, setInitSel] = useState<Sel | null>(null);
  const emitted = useRef(value);
  const selRef = useRef<Sel>({ start: 0, end: 0 });
  const activeRef = useRef<number | null>(null);
  activeRef.current = active;
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const scrollRef = useRef<ScrollView>(null);
  const ys = useRef<Record<number, number>>({});
  // Separator the last block had before "tap below" appended an empty one after it.
  const appended = useRef<{ index: number; sep: string } | null>(null);

  // The text changed from outside (undo, redo, a restored draft): re-read it.
  if (value !== emitted.current) {
    emitted.current = value;
    const next = splitBlocks(value);
    blocksRef.current = next;
    setBlocks(next);
  }

  const emit = useCallback(
    (next: Block[]) => {
      blocksRef.current = next;
      setBlocks(next);
      const text = joinBlocks(next);
      emitted.current = text;
      onChange(text);
    },
    [onChange]
  );

  const activate = useCallback((i: number, caret?: number) => {
    const block = blocksRef.current[i];
    const at = caret ?? block?.text.length ?? 0;
    selRef.current = { start: at, end: at };
    setInitSel({ start: at, end: at });
    setActive(i);
    // Bring the block to the top third so the keyboard and toolbar never cover it.
    const y = ys.current[i];
    if (y != null) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }));
  }, []);

  // Keyboard closed: leave editing, drop blocks the user emptied.
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      if (activeRef.current === null) return;
      setActive(null);
      setInitSel(null);
      const cur = blocksRef.current;
      let pruned = pruneEmptyBlocks(cur);
      const a = appended.current;
      appended.current = null;
      if (a && pruned.length === cur.length - 1 && a.index === pruned.length - 1) {
        pruned = pruned.map((b, i) => (i === a.index ? { ...b, sep: a.sep } : b));
      }
      if (joinBlocks(pruned) !== joinBlocks(cur)) emit(pruned);
      else setBlocks(splitBlocks(joinBlocks(cur)));
    });
    return () => sub.remove();
  }, [emit]);

  const edit = (i: number, text: string) => {
    const next = blocksRef.current.slice();
    next[i] = { ...next[i], text };
    emit(next);
  };

  useImperativeHandle(
    ref,
    () => ({
      apply: (tool) => {
        const cur = blocksRef.current;
        const i = activeRef.current ?? cur.length - 1;
        const text = cur[i]?.text ?? '';
        const sel = activeRef.current === null ? { start: text.length, end: text.length } : selRef.current;
        const r = insertTool(text, sel, tool);
        edit(i, r.text);
        selRef.current = { start: r.caret, end: r.caret };
        setInitSel({ start: r.caret, end: r.caret });
        setActive(i);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const addBlock = () => {
    const cur = blocksRef.current;
    const lastIdx = cur.length - 1;
    if (cur[lastIdx].text.trim() === '') {
      activate(lastIdx);
      return;
    }
    const sep = cur[lastIdx].sep;
    appended.current = { index: lastIdx + 1, sep };
    const next = cur.slice();
    next[lastIdx] = { ...next[lastIdx], sep: sep.length >= 2 ? sep : '\n\n' };
    next.push({ text: '', sep: '' });
    emit(next);
    activate(lastIdx + 1, 0);
  };

  const onLayoutY = useCallback((i: number, y: number) => {
    ys.current[i] = y;
  }, []);

  const empty = blocks.every((b) => b.text.trim() === '');

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {blocks.map((b, i) =>
        active === i ? (
          <View key={i} style={s.activeWrap} onLayout={(e) => (ys.current[i] = e.nativeEvent.layout.y)}>
            <TextInput
              onChangeText={(t) => edit(i, t)}
              selection={initSel ?? undefined}
              onSelectionChange={(e) => {
                selRef.current = e.nativeEvent.selection;
                if (initSel) setInitSel(null);
              }}
              autoFocus
              multiline
              scrollEnabled={false}
              editable={!disabled}
              placeholder={placeholder}
              placeholderTextColor={COLORS.textSubtle}
              style={s.input}
              textAlignVertical="top"
              autoCapitalize="sentences"
            >
              {/* The input is driven by its styled children (same characters as the text),
                  which is how the formatting shows up while typing. */}
              {highlight(b.text).map((sp, k) => (
                <Text key={k} style={spanStyle(sp.f)}>
                  {sp.t}
                </Text>
              ))}
            </TextInput>
            {NEEDS_PREVIEW.test(b.text) ? <LivePreview text={b.text} renderBlock={renderBlock} /> : null}
          </View>
        ) : (
          <RenderedBlock key={i} text={b.text} index={i} onActivate={disabled ? noop : activate} onLayoutY={onLayoutY} renderBlock={renderBlock} />
        )
      )}

      {empty && active === null ? (
        <TouchableOpacity activeOpacity={0.6} onPress={() => activate(0)} disabled={disabled} style={s.emptyHit}>
          <Text style={s.emptyText}>{placeholder ?? 'Tap to start writing…'}</Text>
        </TouchableOpacity>
      ) : (
        // The rest of the page: tap below the last block to keep writing.
        <TouchableOpacity activeOpacity={1} onPress={addBlock} disabled={disabled} style={s.tail} accessibilityLabel="Add text below" />
      )}
    </ScrollView>
  );
});

const noop = () => {};

const s = StyleSheet.create({
  block: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8 },
  activeWrap: {
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 44,
  },
  preview: {
    marginHorizontal: 10,
    marginBottom: 10,
    paddingTop: 8,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  previewKicker: { fontFamily: FONTS.bodyBold, fontSize: 10, letterSpacing: 1.2, color: COLORS.textSubtle },
  tail: { minHeight: 160 },
  emptyHit: { minHeight: 160, paddingHorizontal: 6, paddingTop: 6 },
  emptyText: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textSubtle },
});
