import React, { useState } from 'react';
import { Alert, Keyboard, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { ApiError, adminNotes } from '../api';
import { userMessage } from '../utils/netError';
import { pickNotesWrite } from '../admin/syllabusLogic';
import { DraftBanner, EditorFrame, ErrorBanner, useEditorKeyboardOpen } from '../admin/EditorFrame';
import { MarkdownEditor, modeMenuItems, type EditorMode, type EditorTool } from '../admin/MarkdownEditor';
import { draftAge, useDraft } from '../admin/useDraft';
import { FaqAccordion } from './FaqAccordion';
import { NativeContentRenderer } from './NativeContentRenderer';
import { extractFaqsFromNotes } from '../utils/faqParser';

/**
 * Inline notes editor for admins (SRS-admin-syllabus-notes-app.md ASN-FR-20–24).
 * Opened from TopicNotesScreen's pencil button — same screen students read on,
 * no separate admin browser. Write/Preview share the student renderer, so
 * parity is guaranteed. Save picks update vs patch-append via pickNotesWrite;
 * Clear (delete-to-unset) is behind a confirm and keeps the topic.
 *
 * The text is autosaved as a draft on the phone while it differs from what is
 * published, so a crash or a dropped connection never loses a long edit.
 */

const FAQ_TOOL: EditorTool[] = [
  { label: 'FAQ', icon: 'help-circle', pre: '## Frequently Asked Questions\n\n### Q: ', post: '', block: true },
];

const renderNotesPreview = (text: string) => {
  const preview = extractFaqsFromNotes(text);
  return (
    <>
      <NativeContentRenderer content={preview.notesBody} fontSize={15} />
      {preview.faqs.length > 0 && <FaqAccordion items={preview.faqs} />}
    </>
  );
};

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
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('live');
  const draft = useDraft(`notes:${subjectId}:${topicId}`, text, initialNotes);
  const typing = useEditorKeyboardOpen();

  const busy = saving || clearing;
  const dirty = text !== initialNotes;
  const canSave = dirty && text.trim().length > 0 && !busy;

  const leave = () => {
    draft.clear();
    onClose();
  };

  const doSave = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      const kind = pickNotesWrite(initialNotes, text);
      if (kind === 'none') {
        leave();
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
      draft.clear();
      onSaved();
    } catch (e: any) {
      // The draft stays: a failed save must not cost the admin their text.
      setError(userMessage(e, 'Could not save notes. Your text is kept as a draft on this phone.'));
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
              draft.clear();
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

  return (
    <EditorFrame
      kicker="Edit notes"
      title={topicTitle}
      subtitle={`${text.length} chars · ${text.split('\n').length} lines`}
      dirty={dirty}
      busy={busy}
      onClose={leave}
      scroll={false}
      primary={{
        label: saving ? 'Saving…' : 'Save notes',
        onPress: () => void doSave(),
        disabled: !canSave,
        loading: saving,
        idle: !dirty && !busy,
      }}
      menu={[
        ...modeMenuItems(mode, setMode),
        ...(initialNotes
          ? [{ label: 'Clear notes', icon: 'trash-2' as const, onPress: doClear, disabled: busy, danger: true }]
          : []),
      ]}
    >
      {draft.found && !typing ? (
        <DraftBanner
          age={draftAge(draft.found.savedAt)}
          onRestore={() => {
            setText(draft.found!.text);
            draft.accept();
          }}
          onDiscard={draft.dismiss}
        />
      ) : null}

      <MarkdownEditor
        value={text}
        onChange={(v) => {
          setText(v);
          setError(null);
        }}
        disabled={busy}
        mode={mode}
        onModeChange={setMode}
        placeholder="Write markdown — LaTeX $...$, Mermaid blocks, FAQ at the bottom."
        extraTools={FAQ_TOOL}
        renderPreview={renderNotesPreview}
      />

      <ErrorBanner message={error} />
      {text.trim().length === 0 && initialNotes ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted }}>
          Notes are empty. Use Clear to remove them.
        </Text>
      ) : null}
    </EditorFrame>
  );
};
