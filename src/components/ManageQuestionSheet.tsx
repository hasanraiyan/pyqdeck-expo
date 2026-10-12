import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, ScrollView, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { adminContent } from '../api';
import { userMessage } from '../utils/netError';
import { AuditLink } from '../admin/ui';
import { DraftBanner, EditorField, EditorFrame, ErrorBanner, Segmented } from '../admin/EditorFrame';
import { MarkdownEditor } from '../admin/MarkdownEditor';
import { draftAge, useDraft } from '../admin/useDraft';
import { validateQuestionFields } from '../admin/contentLogic';

/**
 * Add a question to a subject, or edit/delete one. Two tabs so the keyboard
 * never fights a long form: Details (id, year, number, marks, chapter, type)
 * and Text (the question itself, with the same markdown tools and preview as
 * the notes editor). Editing opens on the stored text read straight from the
 * database, never a cached copy.
 */
export const ManageQuestionSheet = ({
  subjectId,
  subjectName,
  questionId,
  suggestedId,
  suggestedYear,
  onSaved,
  onClose,
}: {
  subjectId: string;
  subjectName?: string;
  /** Set to edit that question; omit to add a new one. */
  questionId?: string;
  suggestedId?: string;
  suggestedYear?: number;
  onSaved: (savedQuestionId: string) => void;
  onClose: () => void;
}) => {
  const editing = !!questionId;
  const [loading, setLoading] = useState(editing);
  const [tab, setTab] = useState<'details' | 'text'>(editing ? 'text' : 'details');
  const [qid, setQid] = useState(questionId ?? suggestedId ?? '');
  const [year, setYear] = useState(suggestedYear ? String(suggestedYear) : '');
  const [qNumber, setQNumber] = useState('');
  const [marks, setMarks] = useState('');
  const [chapter, setChapter] = useState('');
  const [type, setType] = useState('');
  const [text, setText] = useState('');
  // What is stored, to know what changed.
  const [base, setBase] = useState({ year: '', qNumber: '', marks: '', chapter: '', type: '', text: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qNumRef = useRef<TextInput>(null);
  const marksRef = useRef<TextInput>(null);
  const chapterRef = useRef<TextInput>(null);
  const typeRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const draft = useDraft(`question:${subjectId}:${questionId ?? 'new'}`, text, base.text);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    adminContent({ action: 'read', level: 'question', subject: subjectId, questionId })
      .then((r) => {
        if (!alive) return;
        const v = {
          year: r.year != null ? String(r.year) : '',
          qNumber: r.qNumber != null ? String(r.qNumber) : '',
          marks: r.marks != null ? String(r.marks) : '',
          chapter: r.chapter && r.chapter !== 'Uncategorized' ? String(r.chapter) : '',
          type: r.type != null ? String(r.type) : '',
          text: String(r.text ?? ''),
        };
        setBase(v);
        setYear(v.year);
        setQNumber(v.qNumber);
        setMarks(v.marks);
        setChapter(v.chapter);
        setType(v.type);
        setText(v.text);
      })
      .catch((e: any) => alive && setError(userMessage(e, 'Could not load the question.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [editing, subjectId, questionId]);

  const busy = saving || deleting;
  const problems = validateQuestionFields({ questionId: qid, year, marks, text, creating: !editing });
  const changed = editing
    ? year !== base.year ||
      qNumber !== base.qNumber ||
      marks !== base.marks ||
      chapter !== base.chapter ||
      type !== base.type ||
      text !== base.text
    : text.trim().length > 0 || qNumber.trim().length > 0;
  const canSave = !loading && !busy && changed && !problems.any;

  const leave = () => {
    draft.clear();
    onClose();
  };

  const fields = () => ({
    text,
    ...(year.trim() ? { year: Number(year) } : {}),
    ...(qNumber.trim() ? { qNumber: qNumber.trim() } : {}),
    ...(marks.trim() ? { marks: Number(marks) } : {}),
    ...(chapter.trim() ? { chapter: chapter.trim() } : {}),
    ...(type.trim() ? { type: type.trim() } : {}),
  });

  const doSave = async () => {
    if (!canSave) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      await adminContent(
        editing
          ? { action: 'update', level: 'question', subject: subjectId, questionId, data: fields() }
          : {
              action: 'create',
              level: 'question',
              subject: subjectId,
              data: { questionId: qid.trim(), ...fields() },
            }
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      draft.clear();
      onSaved(editing ? questionId! : qid.trim());
    } catch (e: any) {
      setError(userMessage(e, 'Could not save the question. Your text is kept as a draft on this phone.'));
      if (problems.any) setTab('details');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete question?',
      'Its solution, votes, reports and topic links are removed with it. This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete question',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await adminContent({ action: 'delete', level: 'question', subject: subjectId, questionId });
              draft.clear();
              onSaved(questionId!);
            } catch (e: any) {
              setError(userMessage(e, 'Could not delete the question.'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <EditorFrame
      kicker={editing ? 'Edit question' : 'Add question'}
      title={editing ? `Question ${questionId}` : subjectName ?? 'New question'}
      subtitle={editing ? subjectName : undefined}
      dirty={changed}
      busy={busy}
      onClose={leave}
      scroll={false}
      primary={{
        label: editing ? 'Save question' : 'Add question',
        onPress: () => void doSave(),
        disabled: !canSave,
        loading: saving,
      }}
      secondary={
        editing ? { label: 'Delete', onPress: doDelete, disabled: busy, loading: deleting, danger: true } : undefined
      }
    >
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>
            Loading the stored question…
          </Text>
        </View>
      ) : (
        <>
          <Segmented
            value={tab}
            onChange={(t) => {
              Keyboard.dismiss();
              setTab(t);
            }}
            options={[
              { value: 'details', label: problems.details ? 'Details •' : 'Details' },
              { value: 'text', label: problems.text ? 'Text •' : 'Text' },
            ]}
          />

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

          {tab === 'details' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {!editing ? (
                <EditorField
                  label="Question ID"
                  hint="Unique inside this subject, e.g. Q12."
                  value={qid}
                  onChangeText={(v) => {
                    setQid(v.replace(/\s/g, ''));
                    setError(null);
                  }}
                  editable={!busy}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => yearRef.current?.focus()}
                  error={qid.length > 0 ? problems.questionId : null}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <EditorField
                    ref={yearRef}
                    label="Year"
                    optional
                    value={year}
                    onChangeText={(v) => setYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                    editable={!busy}
                    keyboardType="number-pad"
                    placeholder="2024"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => qNumRef.current?.focus()}
                    error={problems.year}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <EditorField
                    ref={qNumRef}
                    label="Q number"
                    optional
                    value={qNumber}
                    onChangeText={setQNumber}
                    editable={!busy}
                    placeholder="3a"
                    autoCapitalize="none"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => marksRef.current?.focus()}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <EditorField
                    ref={marksRef}
                    label="Marks"
                    optional
                    value={marks}
                    onChangeText={(v) => setMarks(v.replace(/[^0-9.]/g, '').slice(0, 5))}
                    editable={!busy}
                    keyboardType="decimal-pad"
                    placeholder="10"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => chapterRef.current?.focus()}
                    error={problems.marks}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <EditorField
                    ref={typeRef}
                    label="Type"
                    optional
                    value={type}
                    onChangeText={setType}
                    editable={!busy}
                    placeholder="short / long"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={() => setTab('text')}
                  />
                </View>
              </View>
              <EditorField
                ref={chapterRef}
                label="Chapter"
                optional
                value={chapter}
                onChangeText={setChapter}
                editable={!busy}
                placeholder="e.g. Network Layer"
                autoCapitalize="words"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => typeRef.current?.focus()}
              />
              <ErrorBanner message={error} />
              <AuditLink tool="manage_content" label="View content changes" onNavigate={onClose} />
            </ScrollView>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <MarkdownEditor
                  value={text}
                  onChange={(v) => {
                    setText(v);
                    setError(null);
                  }}
                  disabled={busy}
                  placeholder="Write the question. Use $...$ for math."
                />
              </View>
              {problems.text ? (
                <Text style={{ fontFamily: FONTS.bodySemi, fontSize: 12, color: '#b91c1c' }}>{problems.text}</Text>
              ) : null}
              <ErrorBanner message={error} />
            </>
          )}
        </>
      )}
    </EditorFrame>
  );
};
