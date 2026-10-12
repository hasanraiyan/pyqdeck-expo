import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { adminSyllabus } from '../api';
import { qk } from '../api/queryKeys';
import { userMessage } from '../utils/netError';
import { suggestSlug } from '../admin/syllabusLogic';

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
  const queryClient = useQueryClient();
  const editing = !!subject;
  const [name, setName] = useState(subject?.name ?? '');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [code, setCode] = useState(subject?.code ?? '');
  const [kind, setKind] = useState<'theory' | 'lab'>(subject?.kind ?? 'theory');
  const [pyq, setPyq] = useState(subject?.pyqSubjectId ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || deleting;

  const effSlug = slugTouched && slug.trim() ? slug.trim() : suggestSlug(name);
  const nameErr = !name.trim() ? 'Add a subject name.' : name.trim().length > 120 ? 'At most 120 characters.' : null;
  const slugErr = !editing && !effSlug ? 'Add a name so a slug can be suggested.' : null;
  const canSave = !busy && !nameErr && !slugErr && (editing
    ? name.trim() !== subject!.name || code !== (subject!.code ?? '') || kind !== subject!.kind || pyq.trim() !== (subject!.pyqSubjectId ?? '')
    : true);

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
      await queryClient.invalidateQueries({ queryKey: qk.syllabusSemester(branchId, semester) });
      await queryClient.invalidateQueries({ queryKey: qk.syllabusSemesters(branchId) });
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
              await queryClient.invalidateQueries({ queryKey: qk.syllabusSemester(branchId, semester) });
              await queryClient.invalidateQueries({ queryKey: qk.syllabusSemesters(branchId) });
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
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{editing ? 'EDIT SUBJECT' : 'ADD SUBJECT'}</Text>
          <Text style={s.title} numberOfLines={2}>
            {editing ? subject!.name : `Semester ${semester}`}
          </Text>
          {!editing && <Text style={s.sub}>in {branchId.toUpperCase()} · Semester {semester}</Text>}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close subject editor">
          <Feather name="x" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={s.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. Computer Networks"
        placeholderTextColor={COLORS.textSubtle}
        style={s.input}
        autoCapitalize="words"
      />
      {!editing && (
        <>
          <Text style={s.label}>Slug (editable on create only)</Text>
          <TextInput
            value={slugTouched ? slug : effSlug}
            onChangeText={(v) => {
              setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
              setSlugTouched(true);
              setError(null);
            }}
            editable={!busy}
            placeholder="computer-networks"
            placeholderTextColor={COLORS.textSubtle}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </>
      )}
      <Text style={s.label}>Code (optional)</Text>
      <TextInput
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. CS601"
        placeholderTextColor={COLORS.textSubtle}
        style={s.input}
        autoCapitalize="characters"
      />
      <Text style={s.label}>Kind</Text>
      <View style={s.kindRow}>
        {(['theory', 'lab'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => setKind(k)}
            disabled={busy}
            style={[s.kind, kind === k && s.kindActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === k }}
          >
            <Text style={[s.kindText, kind === k && { color: '#fff' }]}>{k === 'theory' ? 'Theory' : 'Lab'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>PYQ subject id (optional — links past papers)</Text>
      <TextInput
        value={pyq}
        onChangeText={(v) => {
          setPyq(v.trim());
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. sem6_computer_networks (empty = none)"
        placeholderTextColor={COLORS.textSubtle}
        style={s.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!editing && <Text style={s.hint}>Branch moves stay in the MCP admin (decision D2).</Text>}

      {nameErr && name.length > 0 ? <Text style={s.error}>{nameErr}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.actions}>
        {editing ? (
          <TouchableOpacity
            onPress={doDelete}
            disabled={busy}
            style={[s.btn, s.btnDangerGhost, busy && { opacity: 0.4 }]}
            accessibilityLabel="Delete subject"
          >
            {deleting ? <ActivityIndicator color="#b91c1c" /> : <Text style={[s.btnText, { color: '#b91c1c' }]}>Delete</Text>}
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => void doSave()}
          disabled={!canSave}
          style={[s.btn, s.btnPrimary, !canSave && { opacity: 0.45 }]}
          accessibilityLabel={editing ? 'Save subject' : 'Add subject'}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, { color: '#fff' }]}>{editing ? 'Save' : 'Add'}</Text>}
        </TouchableOpacity>
      </View>
      <Text style={s.hint}>Offline edits are blocked — connect to save. Nothing is stored on this phone.</Text>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { gap: 8, paddingBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: COLORS.primary },
  title: { fontFamily: FONTS.displayBold, fontSize: 17, color: COLORS.text, marginTop: 2 },
  sub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  kindRow: { flexDirection: 'row', gap: 8 },
  kind: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  kindActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  kindText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.text },
  error: { fontFamily: FONTS.bodySemi, fontSize: 12, color: '#b91c1c' },
  hint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', minWidth: 96 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDangerGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#fecaca' },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14 },
});
