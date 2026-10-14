import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { COLORS, FONTS } from '../theme/colors';
import { Segmented, useEditorKeyboardOpen, type MenuItem } from './EditorFrame';
import { LiveEditor, type LiveEditorHandle } from './LiveEditor';
import { insertTool } from './markdownEdit';
import { NativeContentRenderer } from '../components/NativeContentRenderer';

/**
 * Markdown writing area shared by the notes, question and solution editors, in
 * three modes: Live (the text shown as students see it, tap a block to edit it),
 * Source (the whole markdown in one input) and Preview (read only). One toolbar
 * rides above the keyboard (undo / redo, then icon buttons for the formatting).
 * Snippets are inserted at the cursor (and wrap a selection) instead of being appended.
 */

export type EditorMode = 'live' | 'edit' | 'preview';

const MODE_ITEMS: Record<EditorMode, { label: string; icon: React.ComponentProps<typeof Feather>['name'] }> = {
  live: { label: 'Live edit', icon: 'layers' },
  edit: { label: 'Markdown source', icon: 'code' },
  preview: { label: 'Preview', icon: 'eye' },
};

/** Menu entries for switching to every mode except the current one. */
export function modeMenuItems(current: EditorMode, setMode: (m: EditorMode) => void): MenuItem[] {
  return (['live', 'edit', 'preview'] as EditorMode[])
    .filter((m) => m !== current)
    .map((m) => ({
      label: MODE_ITEMS[m].label,
      icon: MODE_ITEMS[m].icon,
      onPress: () => {
        if (m === 'preview') Keyboard.dismiss();
        setMode(m);
      },
    }));
}

type Sel = { start: number; end: number };
type IconName = React.ComponentProps<typeof Feather>['name'];

// Feather has no strikethrough / numbered-list / quote / math glyphs, so those
// tools show a short text glyph instead (`strike` draws it struck through).
type Tool = {
  label: string;
  icon?: IconName;
  glyph?: string;
  strike?: boolean;
  pre: string;
  post?: string;
  ph?: string;
  block?: boolean;
};

const FORMAT: Tool[] = [
  { label: 'Bold', icon: 'bold', pre: '**', post: '**', ph: 'text' },
  { label: 'Italic', icon: 'italic', pre: '*', post: '*', ph: 'text' },
  { label: 'Strikethrough', glyph: 'S', strike: true, pre: '~~', post: '~~', ph: 'text' },
  { label: 'Code', icon: 'code', pre: '`', post: '`', ph: 'code' },
];

const BLOCKS: Tool[] = [
  { label: 'Heading', icon: 'type', pre: '## ', block: true },
  { label: 'List', icon: 'list', pre: '- ', block: true },
  { label: 'Numbered list', glyph: '1.', pre: '1. ', block: true },
  { label: 'Quote', glyph: '>', pre: '> ', block: true },
];

const INSERT: Tool[] = [
  { label: 'Math', glyph: '√', pre: '$', post: '$', ph: 'x^2' },
  { label: 'Math block', glyph: 'Σ', pre: '$$\n', post: '\n$$', ph: 'E = mc^2', block: true },
  { label: 'Diagram', icon: 'share-2', pre: '```mermaid\n', post: '\n```', ph: 'graph TD\n  A-->B', block: true },
];

const HISTORY_LIMIT = 100;
// Typing within this window of the last snapshot is one undo step.
const COALESCE_MS = 800;

export const MarkdownEditor = ({
  value,
  onChange,
  disabled,
  placeholder = 'Write markdown. LaTeX with $...$, Mermaid in code blocks.',
  extraTools,
  renderPreview,
  renderBlock,
  mode,
  onModeChange,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Extra buttons at the end of the toolbar (the notes editor adds FAQ). */
  extraTools?: Tool[];
  /** Defaults to the student renderer on the raw text. */
  renderPreview?: (text: string) => React.ReactNode;
  /** How one block looks in Live mode (defaults to the student renderer). */
  renderBlock?: (text: string) => React.ReactNode;
  /** Controlled mode: the host then owns the switch (e.g. in its menu) and the built-in one is hidden. */
  mode?: EditorMode;
  onModeChange?: (m: EditorMode) => void;
}) => {
  const [innerTab, setInnerTab] = useState<EditorMode>('live');
  const controlled = mode !== undefined && !!onModeChange;
  const tab = controlled ? mode : innerTab;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const setTab = useCallback((m: EditorMode) => {
    if (onModeChangeRef.current) onModeChangeRef.current(m);
    else setInnerTab(m);
  }, []);
  // Selection and the latest value live in refs: reading them must never cost a
  // render, and the toolbar callbacks below stay identity-stable so the bar
  // (a dozen icons) is not re-rendered on every keystroke.
  const selRef = useRef<Sel>({ start: 0, end: 0 });
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Set only for the render right after a toolbar insert, to move the caret.
  const [forceSel, setForceSel] = useState<Sel | null>(null);
  const inputRef = useRef<TextInput>(null);
  const liveRef = useRef<LiveEditorHandle>(null);
  const modeRef = useRef<EditorMode>(tab);
  modeRef.current = tab;
  // Coming back from Preview: the caret returns to where it was.
  const mounted = useRef(false);
  useEffect(() => {
    // Not on first open: the text starts at the top with the caret at 0, instead of jumping to the end.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (tab === 'edit') setForceSel({ ...selRef.current });
  }, [tab]);
  const keyboardOpen = useEditorKeyboardOpen();

  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const lastSnap = useRef(0);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const syncHist = () => {
    const undo = past.current.length > 0;
    const redo = future.current.length > 0;
    // Same values -> same state -> no render (this runs on every keystroke).
    setHist((h) => (h.undo === undo && h.redo === redo ? h : { undo, redo }));
  };

  const commit = (next: string, forceSnapshot = false) => {
    const value = valueRef.current;
    if (next === value) return;
    const now = Date.now();
    if (forceSnapshot || now - lastSnap.current > COALESCE_MS || past.current.length === 0) {
      past.current.push(value);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
    }
    lastSnap.current = now;
    future.current = [];
    onChangeRef.current(next);
    syncHist();
  };

  const jump = (from: string, to: string) => {
    // Put the caret where the two versions differ, so undo shows what changed.
    let p = 0;
    while (p < from.length && p < to.length && from[p] === to[p]) p++;
    let q = 0;
    while (q < from.length - p && q < to.length - p && from[from.length - 1 - q] === to[to.length - 1 - q]) q++;
    const caret = to.length - q;
    setForceSel({ start: caret, end: caret });
  };

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    const cur = valueRef.current;
    future.current.push(cur);
    lastSnap.current = 0;
    onChangeRef.current(prev);
    jump(cur, prev);
    syncHist();
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    const cur = valueRef.current;
    past.current.push(cur);
    lastSnap.current = 0;
    onChangeRef.current(next);
    jump(cur, next);
    syncHist();
  }, []);

  const apply = useCallback((tool: Tool) => {
    if (modeRef.current === 'live') {
      // One undo step per snippet, like in Source mode.
      lastSnap.current = 0;
      liveRef.current?.apply(tool);
      return;
    }
    const r = insertTool(valueRef.current, selRef.current, tool);
    commit(r.text, true);
    setForceSel({ start: r.caret, end: r.caret });
    requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPreview = useCallback(() => {
    Keyboard.dismiss();
    setTab('preview');
  }, []);

  const groups = useMemo<Tool[][]>(
    () => [FORMAT, BLOCKS, INSERT, ...(extraTools?.length ? [extraTools] : [])],
    [extraTools]
  );

  return (
    <View style={{ flex: 1, gap: 10 }}>
      {/* While typing, the mode switch gives its row to the text. */}
      {controlled || (keyboardOpen && tab !== 'preview') ? null : (
        <Segmented
          value={tab}
          onChange={(m) => {
            if (m === 'preview') showPreview();
            else setTab(m);
          }}
          options={[
            { value: 'live', label: 'Live' },
            { value: 'edit', label: 'Source' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
      )}

      {tab !== 'preview' ? (
        <View style={{ flex: 1, gap: 8 }}>
          {/* Only the active editor is mounted, so a hidden multi-thousand-character
              input never has to re-lay-out on every keystroke. */}
          {tab === 'live' ? (
            <LiveEditor
              ref={liveRef}
              value={value}
              onChange={commit}
              disabled={disabled}
              placeholder={placeholder}
              renderBlock={renderBlock}
            />
          ) : (
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={commit}
              selection={forceSel ?? undefined}
              onSelectionChange={(e) => {
                selRef.current = e.nativeEvent.selection;
                if (forceSel) setForceSel(null);
              }}
              multiline
              scrollEnabled
              editable={!disabled}
              placeholder={placeholder}
              placeholderTextColor={COLORS.textSubtle}
              style={s.input}
              textAlignVertical="top"
              autoCapitalize="sentences"
            />
          )}

          {keyboardOpen ? (
            <Toolbar
              groups={groups}
              canUndo={hist.undo}
              canRedo={hist.redo}
              disabled={!!disabled}
              onUndo={undo}
              onRedo={redo}
              onApply={apply}
              onPreview={showPreview}
            />
          ) : null}
        </View>
      ) : null}

      {tab === 'preview' ? (
        <ScrollView style={s.preview} contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
          {value.trim() ? (
            renderPreview ? (
              renderPreview(value)
            ) : (
              <NativeContentRenderer content={value} fontSize={15} />
            )
          ) : (
            <Text style={s.empty}>Nothing to preview yet.</Text>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
};

const Toolbar = memo(function Toolbar({
  groups,
  canUndo,
  canRedo,
  disabled,
  onUndo,
  onRedo,
  onApply,
  onPreview,
}: {
  groups: Tool[][];
  canUndo: boolean;
  canRedo: boolean;
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onApply: (tool: Tool) => void;
  onPreview: () => void;
}) {
  return (
    <View style={s.bar}>
      <ToolButton icon="corner-up-left" label="Undo" onPress={onUndo} disabled={disabled || !canUndo} />
      <ToolButton icon="corner-up-right" label="Redo" onPress={onRedo} disabled={disabled || !canRedo} />
      <View style={s.divider} />
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', paddingRight: 4 }}
      >
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 ? <View style={s.divider} /> : null}
            {group.map((tool) => (
              <ToolButton
                key={tool.label}
                icon={tool.icon}
                text={tool.icon ? undefined : tool.glyph ?? tool.label}
                strike={tool.strike}
                label={`Insert ${tool.label}`}
                onPress={() => onApply(tool)}
                disabled={disabled}
              />
            ))}
          </React.Fragment>
        ))}
      </ScrollView>
      <View style={s.divider} />
      <ToolButton icon="eye" label="Preview" onPress={onPreview} disabled={disabled} />
    </View>
  );
});

const ToolButton = ({
  icon,
  text,
  strike,
  label,
  onPress,
  disabled,
}: {
  icon?: IconName;
  text?: string;
  strike?: boolean;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[s.tool, disabled && { opacity: 0.3 }]}
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
  >
    {icon ? (
      <Feather name={icon} size={20} color={COLORS.text} />
    ) : (
      <Text style={[s.toolText, strike && s.toolTextStrike]}>{text}</Text>
    )}
  </TouchableOpacity>
);

export type EditorTool = Tool;

const s = StyleSheet.create({
  input: {
    flex: 1,
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 24,
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 26,
    color: COLORS.text,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 8,
    // Docked: runs edge to edge (cancels the editor body's 16px padding) and sits
    // flush on the keyboard / footer — no rounding, no shadow.
    marginHorizontal: -16,
    marginBottom: -16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tool: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.text },
  toolTextStrike: { textDecorationLine: 'line-through' },
  divider: { width: StyleSheet.hairlineWidth, height: 26, marginHorizontal: 4, backgroundColor: COLORS.border },
  preview: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  empty: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
});
