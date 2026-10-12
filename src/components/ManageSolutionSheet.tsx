import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { ApiError, adminContent } from '../api';
import { userMessage } from '../utils/netError';
import { DraftBanner, EditorFrame, ErrorBanner, type MenuItem } from '../admin/EditorFrame';
import { MarkdownEditor } from '../admin/MarkdownEditor';
import { draftAge, useDraft } from '../admin/useDraft';

/**
 * Add, edit or delete a question's worked solution (the newest one, the same
 * one students see). Opens on the stored text, read straight from the database
 * so it is never a cached copy. A question with no solution opens empty and
 * saves as a new one, marked "manual" so it is not mistaken for AI output.
 */
export const ManageSolutionSheet = ({
  subjectId,
  questionId,
  onSaved,
  onClose,
}: {
  subjectId: string;
  questionId: string;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [original, setOriginal] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const draft = useDraft(`solution:${subjectId}:${questionId}`, text, original);

  useEffect(() => {
    let alive = true;
    adminContent({ action: 'read', level: 'solution', subject: subjectId, questionId })
      .then((r) => {
        if (!alive) return;
        setExists(true);
        setOriginal(String(r.content ?? ''));
        setText(String(r.content ?? ''));
      })
      .catch((e: any) => {
        if (!alive) return;
        // 404 = no solution yet: that is the "add" case, not a failure.
        if (!(e instanceof ApiError && e.status === 404)) {
          setError(userMessage(e, 'Could not load the solution.'));
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [subjectId, questionId]);

  const busy = saving || deleting;
  const dirty = text !== original;
  const canSave = !loading && !busy && dirty && text.trim().length > 0;

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
      await adminContent(
        exists
          ? { action: 'update', level: 'solution', subject: subjectId, questionId, data: { content: text } }
          : {
              action: 'create',
              level: 'solution',
              subject: subjectId,
              questionId,
              data: { content: text, type: 'manual' },
            }
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      draft.clear();
      onSaved();
    } catch (e: any) {
      setError(userMessage(e, 'Could not save the solution. Your text is kept as a draft on this phone.'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    Alert.alert(
      'Delete solution?',
      'Students will no longer see a solution for this question. Votes and reports on it go too.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete solution',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await adminContent({ action: 'delete', level: 'solution', subject: subjectId, questionId });
              draft.clear();
              onSaved();
            } catch (e: any) {
              setError(userMessage(e, 'Could not delete the solution.'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const menu: MenuItem[] = loading
    ? []
    : [
        mode === 'edit'
          ? { label: 'Preview', icon: 'eye' as const, onPress: () => { Keyboard.dismiss(); setMode('preview'); } }
          : { label: 'Write', icon: 'edit-3' as const, onPress: () => setMode('edit') },
        ...(exists
          ? [{ label: 'Delete solution', icon: 'trash-2' as const, onPress: doDelete, disabled: busy, danger: true }]
          : []),
      ];

  return (
    <EditorFrame
      kicker={exists ? 'Edit solution' : 'Add solution'}
      title={`Question ${questionId}`}
      subtitle={`${text.length} chars`}
      dirty={dirty}
      busy={busy}
      onClose={leave}
      scroll={false}
      primary={{
        label: saving ? 'Saving…' : exists ? 'Save solution' : 'Add solution',
        onPress: () => void doSave(),
        disabled: !canSave,
        loading: saving,
        idle: exists && !dirty && !busy,
      }}
      menu={menu}
    >
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>
            Loading the stored solution…
          </Text>
        </View>
      ) : (
        <>
          {draft.found ? (
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
            placeholder="Write the worked solution in markdown. Use $...$ for math."
          />
          <ErrorBanner message={error} />
        </>
      )}
    </EditorFrame>
  );
};
