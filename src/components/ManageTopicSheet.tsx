import React, { useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { adminSyllabus } from '../api';
import { userMessage } from '../utils/netError';
import { deleteConfirmText, parseTopicTitles, validateTopicTitle } from '../admin/syllabusLogic';
import { AuditLink } from '../admin/ui';
import { EditorField, EditorFrame, EditorNote, ErrorBanner } from '../admin/EditorFrame';

/**
 * Inline topic add/rename/delete (ASN-FR-14/30). Opened from
 * SubjectSyllabusScreen's topic rows — no separate admin browser.
 * Add mode takes one title plus a bulk box (one per line → titles[]).
 * Rename warns the id is kept (links + progress survive). Delete states the
 * notes + link consequences and sends confirm:true.
 */
export const ManageTopicSheet = ({
  subjectId,
  moduleId,
  moduleTitle,
  topic,
  linkCount,
  onSaved,
  onClose,
}: {
  subjectId: string;
  moduleId: string;
  moduleTitle: string;
  topic: { id: string; title: string; prompt?: string; hasNotes?: boolean } | null;
  linkCount?: number;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const editing = !!topic;
  const [title, setTitle] = useState(topic?.title ?? '');
  const [prompt, setPrompt] = useState(topic?.prompt ?? '');
  const [bulk, setBulk] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || deleting;
  const secondRef = useRef<TextInput>(null);

  const bulkTitles = editing ? [] : parseTopicTitles(bulk);
  const titleErr = validateTopicTitle(title);
  const canSave = editing
    ? !busy && !titleErr && (title.trim() !== topic!.title || prompt !== (topic!.prompt ?? ''))
    : !busy && (bulkTitles.length > 0 || !titleErr);

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await adminSyllabus({
          action: 'update',
          level: 'topic',
          subject: subjectId,
          module: moduleId,
          topic: topic!.id,
          data: { title: title.trim(), ...(prompt !== (topic!.prompt ?? '') ? { prompt } : {}) },
        });
      } else if (bulkTitles.length > 0) {
        const titles = (!titleErr ? [title.trim()] : []).concat(
          bulkTitles.filter((t) => t.toLowerCase() !== title.trim().toLowerCase())
        );
        await adminSyllabus({
          action: 'create',
          level: 'topic',
          subject: subjectId,
          module: moduleId,
          data: titles.length === 1 ? { title: titles[0] } : { titles },
        });
      } else {
        await adminSyllabus({
          action: 'create',
          level: 'topic',
          subject: subjectId,
          module: moduleId,
          data: { title: title.trim() },
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
    } catch (e: any) {
      setError(userMessage(e, 'Could not save the topic.'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete topic?',
      `${deleteConfirmText('topic', { topics: 1, notes: topic!.hasNotes ? 1 : 0 })}${linkCount ? ` ${linkCount} PYQ links point here.` : ''}`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete topic',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await adminSyllabus({
                action: 'delete',
                level: 'topic',
                subject: subjectId,
                module: moduleId,
                topic: topic!.id,
                confirm: true,
              });
                      Alert.alert(
                'Topic deleted',
                "Students keep their own ticks on their phones, but this topic no longer counts toward progress. Its PYQ links are orphaned.",
                [{ text: 'Done', onPress: onSaved }]
              );
            } catch (e: any) {
              setError(userMessage(e, 'Could not delete the topic.'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const dirty = editing
    ? title.trim() !== topic!.title || prompt !== (topic!.prompt ?? '')
    : title.trim().length > 0 || bulk.trim().length > 0;
  const addCount = (!titleErr ? 1 : 0) + bulkTitles.length;

  return (
    <EditorFrame
      kicker={editing ? 'Edit topic' : 'Add topic'}
      title={editing ? topic!.title : moduleTitle}
      subtitle={editing ? undefined : `in ${moduleTitle}`}
      dirty={dirty}
      busy={busy}
      onClose={onClose}
      primary={{
        label: editing ? 'Save' : addCount > 1 ? `Add ${addCount} topics` : 'Add topic',
        onPress: () => void doSave(),
        disabled: !canSave,
        loading: saving,
      }}
      secondary={editing ? { label: 'Delete', onPress: doDelete, disabled: busy, loading: deleting, danger: true } : undefined}
    >
      <EditorField
        label="Title"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. Subnetting"
        autoCapitalize="sentences"
        autoFocus={!editing}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => secondRef.current?.focus()}
        error={title.length > 0 && titleErr && bulkTitles.length === 0 ? titleErr : null}
      />
      {editing ? (
        <EditorField
          ref={secondRef}
          label="Ask AI prompt override"
          optional
          value={prompt}
          onChangeText={setPrompt}
          editable={!busy}
          placeholder="Leave empty for the default prompt"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void doSave()}
          hint="Renaming keeps the topic id, so PYQ links and student progress survive."
        />
      ) : (
        <EditorField
          ref={secondRef}
          label="Add many at once"
          optional
          value={bulk}
          onChangeText={(v) => {
            setBulk(v);
            setError(null);
          }}
          editable={!busy}
          multiline
          placeholder={'Flow control\nError control\nSliding window'}
          hint={bulkTitles.length > 0 ? `${bulkTitles.length} topics will be added.` : 'One topic per line.'}
        />
      )}

      <ErrorBanner message={error} />
      <EditorNote>Needs a connection to save. Nothing is stored on this phone.</EditorNote>
      <AuditLink tool="manage_syllabus" label="View syllabus changes" onNavigate={onClose} />
    </EditorFrame>
  );
};
