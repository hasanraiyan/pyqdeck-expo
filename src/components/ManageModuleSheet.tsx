import React, { useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { adminSyllabus } from '../api';
import { userMessage } from '../utils/netError';
import { deleteConfirmText, validateModuleTitle } from '../admin/syllabusLogic';
import { AuditLink } from '../admin/ui';
import { EditorField, EditorFrame, EditorNote, ErrorBanner } from '../admin/EditorFrame';

/**
 * Inline module add/rename/delete (ASN-FR-13/30). Opened from
 * SubjectSyllabusScreen's module headers — no separate admin browser.
 * Delete states the cascade count and sends confirm:true.
 */
export const ManageModuleSheet = ({
  subjectId,
  module,
  topicCount,
  notesCount,
  nextNumber,
  onSaved,
  onClose,
}: {
  subjectId: string;
  module: { id: string; number: number; title: string } | null;
  topicCount: number;
  notesCount: number;
  nextNumber: number;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const editing = !!module;
  const [number, setNumber] = useState(String(module?.number ?? nextNumber));
  const [title, setTitle] = useState(module?.title ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || deleting;
  const numberRef = useRef<TextInput>(null);

  const num = Number(number);
  const numErr = !Number.isInteger(num) || num < 1 || num > 32 ? 'Number must be 1–32.' : null;
  const titleErr = validateModuleTitle(title);
  const dirty = editing
    ? title.trim() !== module!.title || num !== module!.number
    : !titleErr && !numErr;
  const canSave = !busy && !titleErr && !numErr && (editing ? dirty : true);

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await adminSyllabus({
          action: 'update',
          level: 'module',
          subject: subjectId,
          module: module!.id,
          data: { number: num, title: title.trim() },
        });
      } else {
        await adminSyllabus({
          action: 'create',
          level: 'module',
          subject: subjectId,
          data: { number: num, title: title.trim(), topics: [] },
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
    } catch (e: any) {
      setError(userMessage(e, 'Could not save the module.'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete module?',
      deleteConfirmText('module', { topics: topicCount, notes: notesCount }),
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete module',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await adminSyllabus({
                action: 'delete',
                level: 'module',
                subject: subjectId,
                module: module!.id,
                confirm: true,
              });
                      Alert.alert(
                'Module deleted',
                'Students keep their own ticks on their phones, but the removed topics no longer count toward progress.',
                [{ text: 'Done', onPress: onSaved }]
              );
            } catch (e: any) {
              setError(userMessage(e, 'Could not delete the module.'));
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
      kicker={editing ? 'Edit module' : 'Add module'}
      title={editing ? module!.title : 'New module'}
      dirty={editing ? dirty : title.trim().length > 0}
      busy={busy}
      onClose={onClose}
      primary={{
        label: editing ? 'Save' : 'Add module',
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
        placeholder="e.g. Network Layer"
        autoCapitalize="sentences"
        autoFocus={!editing}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => numberRef.current?.focus()}
        error={titleErr && title.length > 0 ? titleErr : null}
      />
      <EditorField
        ref={numberRef}
        label="Module number"
        value={number}
        onChangeText={(v) => {
          setNumber(v.replace(/[^0-9]/g, ''));
          setError(null);
        }}
        editable={!busy}
        keyboardType="number-pad"
        returnKeyType="done"
        onSubmitEditing={() => void doSave()}
        error={numErr}
        hint="Order in the syllabus, 1 to 32."
      />

      <ErrorBanner message={error} />
      <EditorNote>Needs a connection to save. Nothing is stored on this phone.</EditorNote>
      <AuditLink tool="manage_syllabus" label="View syllabus changes" onNavigate={onClose} />
    </EditorFrame>
  );
};
