import React, { useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS } from '../theme/colors';
import { Segmented } from './EditorFrame';
import { NativeContentRenderer } from '../components/NativeContentRenderer';

/**
 * Markdown writing area shared by the notes, question and solution editors:
 * Write/Preview switch, a writing box that fills the space, and a formatting
 * bar that rides above the keyboard. Snippets are inserted at the cursor (and
 * wrap a selection) instead of being appended to the end.
 */

type Sel = { start: number; end: number };

const TOOLS: { label: string; pre: string; post?: string; ph?: string; block?: boolean }[] = [
  { label: 'Bold', pre: '**', post: '**', ph: 'text' },
  { label: 'List', pre: '- ', block: true },
  { label: 'Heading', pre: '## ', block: true },
  { label: '$ math $', pre: '$', post: '$', ph: 'x^2' },
  { label: '$$ block $$', pre: '$$\n', post: '\n$$', ph: 'E = mc^2', block: true },
  { label: 'Mermaid', pre: '```mermaid\n', post: '\n```', ph: 'graph TD\n  A-->B', block: true },
];

export const MarkdownEditor = ({
  value,
  onChange,
  disabled,
  placeholder = 'Write markdown. LaTeX with $...$, Mermaid in code blocks.',
  extraTools,
  renderPreview,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Extra buttons for the formatting bar (the notes editor adds FAQ). */
  extraTools?: typeof TOOLS;
  /** Defaults to the student renderer on the raw text. */
  renderPreview?: (text: string) => React.ReactNode;
}) => {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [sel, setSel] = useState<Sel>({ start: value.length, end: value.length });
  // Set only for the render right after a toolbar insert, to move the caret.
  const [forceSel, setForceSel] = useState<Sel | null>(null);
  const inputRef = useRef<TextInput>(null);
  const tools = extraTools ? [...TOOLS, ...extraTools] : TOOLS;

  const apply = (tool: (typeof TOOLS)[number]) => {
    const { start, end } = sel;
    const inner = value.slice(start, end) || tool.ph || '';
    // Block snippets (lists, headings, code) start on their own line.
    const lead = tool.block && start > 0 && value[start - 1] !== '\n' ? '\n' : '';
    const insert = `${lead}${tool.pre}${inner}${tool.post ?? ''}`;
    const caret = start + lead.length + tool.pre.length + inner.length;
    onChange(value.slice(0, start) + insert + value.slice(end));
    setForceSel({ start: caret, end: caret });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <Segmented
        value={tab}
        onChange={(t) => {
          if (t === 'preview') Keyboard.dismiss();
          setTab(t);
        }}
        options={[
          { value: 'edit', label: 'Write' },
          { value: 'preview', label: 'Preview' },
        ]}
      />

      {tab === 'edit' ? (
        <View style={{ flex: 1, gap: 8 }}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            selection={forceSel ?? undefined}
            onSelectionChange={(e) => {
              setSel(e.nativeEvent.selection);
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
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {tools.map((tool) => (
              <TouchableOpacity
                key={tool.label}
                onPress={() => apply(tool)}
                disabled={disabled}
                style={s.tool}
                accessibilityLabel={`Insert ${tool.label}`}
              >
                <Text style={s.toolText}>{tool.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
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
      )}
    </View>
  );
};

export type EditorTool = (typeof TOOLS)[number];

const s = StyleSheet.create({
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  tool: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.text },
  preview: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  empty: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
});
