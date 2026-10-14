import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { adminSyllabus, searchSubjects } from '../api';
import { userMessage } from '../utils/netError';
import { suggestSlug } from '../admin/syllabusLogic';
import { AuditLink } from '../admin/ui';
import { EditorField, EditorFrame, EditorNote, ErrorBanner, Segmented } from '../admin/EditorFrame';

/**
 * Inline subject add/rename/delete (ASN-FR-12/30). Opened from
 * SyllabusOverviewScreen's section headers — no separate admin browser.
 * Create inherits branch+semester from the open semester; slug is
 * auto-suggested (editable on create only). Branch moves stay MCP-only (D2).
 * Delete states the cascade and sends confirm:true.
 */
export const ManageSubjectSheet = ({
  branchId,
  semester,
  subject,
  onSaved,
  onClose,
}: {
  branchId: string;
  semester: number;
  subject: { id: string; name: string; code?: string; kind: 'theory' | 'lab'; moduleCount: number; topicCount: number; pyqSubjectId?: string } | null;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const editing = !!subject;
  const [name, setName] = useState(subject?.name ?? '');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [code, setCode] = useState(subject?.code ?? '');
  const [kind, setKind] = useState<'theory' | 'lab'>(subject?.kind ?? 'theory');
  const [pyq, setPyq] = useState(subject?.pyqSubjectId ?? '');
  const [pyqName, setPyqName] = useState<string | null>(null);
  const [pyqQuery, setPyqQuery] = useState('');
  const [pyqResults, setPyqResults] = useState<{ id: string; name: string; code: string }[]>([]);
  const [pyqSearching, setPyqSearching] = useState(false);
  const [pyqErr, setPyqErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || deleting;
  const pyqTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slugRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  // Searchable PYQ picker (Phase 4 polish): debounced, min 2 chars, pick from
  // the archive instead of typing a slug blind. Empty = no link.
  useEffect(() => {
    if (pyqTimer.current) clearTimeout(pyqTimer.current);
    const q = pyqQuery.trim();
    if (q.length < 2) {
      setPyqResults([]);
      setPyqSearching(false);
      return;
    }
    setPyqSearching(true);
    pyqTimer.current = setTimeout(() => {
      searchSubjects(q, 8)
        .then((r) => {
          setPyqResults((r.subjects ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code })));
          setPyqErr(null);
        })
        .catch((e: any) => setPyqErr(userMessage(e, 'Search failed.')))
        .finally(() => setPyqSearching(false));
    }, 300);
    return () => {
      if (pyqTimer.current) clearTimeout(pyqTimer.current);
    };
  }, [pyqQuery]);

  const effSlug = slugTouched && slug.trim() ? slug.trim() : suggestSlug(name);
  const nameErr = !name.trim() ? 'Add a subject name.' : name.trim().length > 120 ? 'At most 120 characters.' : null;
  const slugErr = !editing && !effSlug ? 'Add a name so a slug can be suggested.' : null;
  const changed = editing
    ? name.trim() !== subject!.name ||
      code !== (subject!.code ?? '') ||
      kind !== subject!.kind ||
      pyq.trim() !== (subject!.pyqSubjectId ?? '')
    : name.trim().length > 0 || code.trim().length > 0 || pyq.trim().length > 0;
  const canSave = !busy && !nameErr && !slugErr && (editing ? changed : true);

  const doSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await adminSyllabus({
          action: 'update',
          level: 'subject',
          subject: subject!.id,
          data: {
            name: name.trim(),
            code: code.trim(),
            kind,
            pyqSubjectId: pyq.trim(),
          },
        });
      } else {
        await adminSyllabus({
          action: 'create',
          level: 'subject',
          data: {
            slug: effSlug,
            name: name.trim(),
            code: code.trim(),
            semester,
            branches: [branchId],
            kind,
            ...(pyq.trim() ? { pyqSubjectId: pyq.trim() } : {}),
            modules: [],
          },
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
    Alert.alert(
      'Delete subject?',
      `This subject holds ${subject!.moduleCount} modules and ${subject!.topicCount} topics. Everything, including notes, will be removed. Student progress for it becomes inert.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete subject',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setError(null);
            try {
              await adminSyllabus({ action: 'delete', level: 'subject', subject: subject!.id, confirm: true });
              Alert.alert(
                'Subject deleted',
                'Students keep their own ticks on their phones, but the removed topics no longer count toward progress.',
                [{ text: 'Done', onPress: onSaved }]
              );
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
      title={editing ? subject!.name : `Semester ${semester}`}
      subtitle={editing ? undefined : `in ${branchId.toUpperCase()} · Semester ${semester}`}
      dirty={changed}
      busy={busy}
      onClose={onClose}
      primary={{
        label: editing ? 'Save' : 'Add subject',
        onPress: () => void doSave(),
        disabled: !canSave,
        loading: saving,
      }}
      secondary={editing ? { label: 'Delete', onPress: doDelete, disabled: busy, loading: deleting, danger: true } : undefined}
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
      {!editing && (
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
          placeholder="computer-networks"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => codeRef.current?.focus()}
        />
      )}
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

      <View style={{ gap: 6 }}>
        <Text style={s.label}>Kind</Text>
        <Segmented
          value={kind}
          disabled={busy}
          onChange={setKind}
          options={[
            { value: 'theory', label: 'Theory' },
            { value: 'lab', label: 'Lab' },
          ]}
        />
      </View>

      <View style={{ gap: 6 }}>
        <View style={s.labelRow}>
          <Text style={s.label}>Past papers</Text>
          <Text style={s.optional}>optional · links this subject to its PYQ archive</Text>
        </View>
        {pyq ? (
          <View style={s.pyqSel}>
            <View style={{ flex: 1 }}>
              <Text style={s.pyqSelName} numberOfLines={1}>
                {pyqName ?? pyq}
              </Text>
              {pyqName && (
                <Text style={s.pyqSelId} numberOfLines={1}>
                  {pyq}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setPyq('');
                setPyqName(null);
                setError(null);
              }}
              disabled={busy}
              hitSlop={12}
              accessibilityLabel="Remove past-paper link"
            >
              <Feather name="x-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <EditorField
              label="Search the archive"
              value={pyqQuery}
              onChangeText={(v) => {
                setPyqQuery(v);
                setPyqErr(null);
              }}
              editable={!busy}
              placeholder="Type 2+ letters…"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              error={pyqErr}
            />
            {pyqSearching && <ActivityIndicator color={COLORS.primary} style={{ alignSelf: 'flex-start' }} />}
            {pyqResults
              .filter((r) => r.id !== pyq)
              .map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => {
                    setPyq(r.id);
                    setPyqName(r.name);
                    setPyqQuery('');
                    setPyqResults([]);
                    setError(null);
                  }}
                  disabled={busy}
                  style={s.pyqOpt}
                  accessibilityLabel={`Link past papers from ${r.name}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.pyqOptName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={s.pyqOptId} numberOfLines={1}>
                      {[r.code, r.id].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Feather name="link" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
          </>
        )}
      </View>

      <ErrorBanner message={error} />
      {!editing && <EditorNote>Branch moves stay in the MCP admin (decision D2).</EditorNote>}
      <EditorNote>Needs a connection to save. Nothing is stored on this phone.</EditorNote>
      <AuditLink tool="manage_syllabus" label="View syllabus changes" onNavigate={onClose} />
    </EditorFrame>
  );
};

const s = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  label: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.text },
  optional: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  pyqSel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pyqSelName: { fontFamily: FONTS.bodySemi, fontSize: 15, color: COLORS.text },
  pyqSelId: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  pyqOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pyqOptName: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  pyqOptId: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle, marginTop: 1 },
});
