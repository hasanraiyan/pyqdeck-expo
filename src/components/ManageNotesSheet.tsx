import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { ApiError, adminNotes } from '../api';
import { userMessage } from '../utils/netError';
import { pickNotesWrite } from '../admin/syllabusLogic';
import { AuditLink } from '../admin/ui';
import { EditorFrame, ErrorBanner, Segmented } from '../admin/EditorFrame';
import { NativeContentRenderer } from './NativeContentRenderer';
import { FaqAccordion } from './FaqAccordion';
import { extractFaqsFromNotes } from '../utils/faqParser';

/**
 * Inline notes editor for admins (SRS-admin-syllabus-notes-app.md ASN-FR-20–24).
 * Opened from TopicNotesScreen's pencil button — same screen students read on,
 * no separate admin browser. Edit/Preview tabs share the student renderer, so
 * parity is guaranteed. Save picks update vs patch-append via pickNotesWrite;
 * Clear (delete-to-unset) is behind a confirm and keeps the topic.
 *
 * Layout: the writing area fills the screen and the formatting bar rides just
 * above the keyboard. Snippets go in at the cursor (wrapping a selection), not
 * at the end of the text.
 */

type Sel = { start: number; end: number };

// `caret` counts back from the end of the inserted text, so the cursor lands
// inside the markers (between the $ $, in the "Q:" line, ...).
const TOOLS: { label: string; pre: string; post?: string; ph?: string; block?: boolean }[] = [
  { label: 'Bold', pre: '**', post: '**', ph: 'text' },
  { label: 'List', pre: '- ', block: true },
  { label: 'Heading', pre: '## ', block: true },
  { label: '$ math $', pre: '$', post: '$', ph: 'x^2' },
  { label: '$$ block $$', pre: '$$\n', post: '\n$$', ph: 'E = mc^2', block: true },
  { label: 'Mermaid', pre: '```mermaid\n', post: '\n```', ph: 'graph TD\n  A-->B', block: true },
  { label: 'FAQ', pre: '## Frequently Asked Questions\n\n### Q: ', post: '', block: true },
];

export const ManageNotesSheet = ({
  subjectId,
  moduleId,
  topicId,
  topicTitle,
  initialNotes,
  onSaved,
  onClose,
}: {
  subjectId: string;
  moduleId: string;
  topicId: string;
  topicTitle: string;
  initialNotes: string;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const [text, setText] = useState(initialNotes);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>({ start: initialNotes.length, end: initialNotes.length });
  // Set only for the render right after a toolbar insert, to move the caret;
  // otherwise the input owns its selection.
  const [forceSel, setForceSel] = useState<Sel | null>(null);
  const inputRef = useRef<TextInput>(null);

  const busy = saving || clearing;
  const dirty = text !== initialNotes;
  const canSave = dirty && text.trim().length > 0 && !busy;

  const apply = (tool: (typeof TOOLS)[number]) => {
    const { start, end } = sel;
    const selected = text.slice(start, end);
    const inner = selected || tool.ph || '';
    // Block snippets (lists, headings, code) start on their own line.
    const lead = tool.block && start > 0 && text[start - 1] !== '\n' ? '\n' : '';
    const insert = `${lead}${tool.pre}${inner}${tool.post ?? ''}`;
    const next = text.slice(0, start) + insert + text.slice(end);
    // Cursor: after the placeholder/selection, before the closing marker.
    const caret = start + lead.length + tool.pre.length + inner.length;
    setText(next);
    setForceSel({ start: caret, end: caret });
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const doSave = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const kind = pickNotesWrite(initialNotes, text);
      if (kind === 'none') {
        onClose();
        return;
      }
      if (kind === 'patch-append') {
        await adminNotes({
          action: 'patch',
          subject: subjectId,
          module: moduleId,
          topic: topicId,
          append: text.slice(initialNotes.length),
        });
      } else if (kind === 'patch-replace') {
        // Single-hunk replace: find the removed slice exactly. Fall back to
        // full update when the hunk cannot be isolated (patch is exact-match).
        let p = 0;
        while (p < initialNotes.length && p < text.length && initialNotes[p] === text[p]) p++;
        let s = 0;
        while (
          s < initialNotes.length - p &&
          s < text.length - p &&
          initialNotes[initialNotes.length - 1 - s] === text[text.length - 1 - s]
        ) {
          s++;
        }
        const find = initialNotes.slice(p, initialNotes.length - s);
        const replace = text.slice(p, text.length - s);
        try {
          await adminNotes({
            action: 'patch',
            subject: subjectId,
            module: moduleId,
            topic: topicId,
            edits: [{ find, replace }],
          });
        } catch (e) {
          if (e instanceof ApiError && e.status === 400) {
            await adminNotes({ action: 'update', subject: subjectId, module: moduleId, topic: topicId, notes: text });
          } else {
            throw e;
          }
        }
      } else {
        await adminNotes({ action: 'update', subject: subjectId, module: moduleId, topic: topicId, notes: text });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
    } catch (e: any) {
      setError(userMessage(e, 'Could not save notes.'));
    } finally {
      setSaving(false);
    }
  };

  const doClear = () => {
    Alert.alert(
      'Clear notes?',
      'Students will no longer see a notes icon on this topic. The topic itself stays.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Clear notes',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            setError(null);
            try {
              await adminNotes({ action: 'delete', subject: subjectId, module: moduleId, topic: topicId });
              onSaved();
            } catch (e: any) {
              setError(userMessage(e, 'Could not clear notes.'));
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const preview = extractFaqsFromNotes(text);

  return (
    <EditorFrame
      kicker="Edit notes"
      title={topicTitle}
      subtitle={`${text.length} chars · ${text.split('\n').length} lines`}
      dirty={dirty}
      busy={busy}
      onClose={onClose}
      scroll={false}
      primary={{ label: 'Save notes', onPress: () => void doSave(), disabled: !canSave, loading: saving }}
      secondary={
        initialNotes
          ? { label: 'Clear', onPress: doClear, disabled: busy, loading: clearing, danger: true }
          : undefined
      }
    >
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
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            selection={forceSel ?? undefined}
            onSelectionChange={(e) => {
              setSel(e.nativeEvent.selection);
              if (forceSel) setForceSel(null);
            }}
            multiline
            scrollEnabled
            editable={!busy}
            placeholder="Write markdown — LaTeX $...$, Mermaid blocks, FAQ at the bottom."
            placeholderTextColor={COLORS.textSubtle}
            style={s.input}
            textAlignVertical="top"
            autoCapitalize="sentences"
          />
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
            style={s.toolbar}
            contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          >
            {TOOLS.map((tool) => (
              <TouchableOpacity
                key={tool.label}
                onPress={() => apply(tool)}
                disabled={busy}
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
          {text.trim() ? (
            <>
              <NativeContentRenderer content={preview.notesBody} fontSize={15} />
              {preview.faqs.length > 0 && <FaqAccordion items={preview.faqs} />}
            </>
          ) : (
            <Text style={s.empty}>Nothing to preview yet.</Text>
          )}
        </ScrollView>
      )}

      <ErrorBanner message={error} />
      {text.trim().length === 0 && initialNotes ? (
        <Text style={s.empty}>Notes are empty. Use Clear to remove them.</Text>
      ) : null}
      <AuditLink tool="manage_notes" label="View notes changes" onNavigate={onClose} />
    </EditorFrame>
  );
};

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
  toolbar: { flexGrow: 0 },
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
