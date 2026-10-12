import React, { useRef, useState } from 'react';
import { Alert, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { adminCatalog } from '../api';
import { userMessage } from '../utils/netError';
import { suggestSlug } from '../admin/syllabusLogic';
import { AuditLink } from '../admin/ui';
import { EditorField, EditorFrame, EditorNote, ErrorBanner } from '../admin/EditorFrame';

/**
 * Add, rename or delete a past-paper subject (the catalog students browse by
 * semester). This is the PYQ catalog, not the syllabus tree: the syllabus has its
 * own sheet (ManageSubjectSheet). Delete states the cascade first.
 */
export const ManagePyqSubjectSheet = ({
  semesterId,
  semesterNumber,
  subject,
  onSaved,
  onClose,
}: {
  /** Parent semester for a new subject. */
  semesterId: string;
  semesterNumber?: number;
  /** Set to edit; omit to add. */
  subject?: { id: string; name: string; code?: string; questionCount?: number } | null;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const editing = !!subject;
  const [name, setName] = useState(subject?.name ?? '');
  const [code, setCode] = useState(subject?.code ?? '');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slugRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const busy = saving || deleting;

  const effSlug = slugTouched && slug.trim() ? slug.trim() : suggestSlug(name);
  const nameErr = !name.trim() ? 'Add a subject name.' : name.trim().length > 120 ? 'At most 120 characters.' : null;
  const slugErr = !editing && !effSlug ? 'Add a name so a slug can be suggested.' : null;
  const changed = editing
    ? name.trim() !== subject!.name.trim() || code.trim() !== (subject!.code ?? '').trim()
    : name.trim().length > 0 || code.trim().length > 0;
  const canSave = !busy && !nameErr && !slugErr && changed;

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await adminCatalog({
          action: 'update',
          level: 'subject',
          subject: subject!.id,
          data: { name: name.trim(), code: code.trim() },
        });
      } else {
        await adminCatalog({
          action: 'create',
          level: 'subject',
          data: { semester: semesterId, slug: effSlug, name: name.trim(), code: code.trim() },
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSaved();
    } catch (e: any) {
      setError(userMessage(e, 'Could not save the subject.'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    if (!editing) return;
    const n = subject!.questionCount ?? 0;
    Alert.alert(
      'Delete subject?',
      `${n ? `${n} questions and their solutions` : 'Everything in it'} will be removed with it. This cannot be undone.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete subject',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await adminCatalog({ action: 'delete', level: 'subject', subject: subject!.id });
              onSaved();
            } catch (e: any) {
              setError(userMessage(e, 'Could not delete the subject.'));
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
      kicker={editing ? 'Edit subject' : 'Add subject'}
      title={editing ? subject!.name : semesterNumber ? `Semester ${semesterNumber}` : 'New subject'}
      dirty={changed}
      busy={busy}
      onClose={onClose}
      primary={{
        label: editing ? 'Save' : 'Add subject',
        onPress: () => void doSave(),
        disabled: !canSave,
        loading: saving,
      }}
      secondary={
        editing ? { label: 'Delete', onPress: doDelete, disabled: busy, loading: deleting, danger: true } : undefined
      }
    >
      <EditorField
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. Computer Networks"
        autoCapitalize="words"
        autoFocus={!editing}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => (editing ? codeRef : slugRef).current?.focus()}
        error={name.length > 0 ? nameErr : null}
      />
      {!editing ? (
        <EditorField
          ref={slugRef}
          label="Slug"
          hint="The id in links. Suggested from the name; can only be set now."
          value={slugTouched ? slug : effSlug}
          onChangeText={(v) => {
            setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
            setSlugTouched(true);
            setError(null);
          }}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => codeRef.current?.focus()}
        />
      ) : null}
      <EditorField
        ref={codeRef}
        label="Subject code"
        optional
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. CS601"
        autoCapitalize="characters"
        returnKeyType="done"
        onSubmitEditing={() => void doSave()}
      />
      <ErrorBanner message={error} />
      <EditorNote>Needs a connection to save. Nothing is stored on this phone.</EditorNote>
      <AuditLink tool="manage_catalog" label="View catalog changes" onNavigate={onClose} />
    </EditorFrame>
  );
};
