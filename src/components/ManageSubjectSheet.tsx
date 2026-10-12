import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { adminSyllabus, searchSubjects } from '../api';
import { qk } from '../api/queryKeys';
import { userMessage } from '../utils/netError';
import { suggestSlug } from '../admin/syllabusLogic';
import { AuditLink } from '../admin/ui';

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
      <Text style={s.label}>Past papers (optional — links this subject to its PYQ archive)</Text>
      {pyq ? (
        <View style={s.pyqSel}>
          <View style={{ flex: 1 }}>
            <Text style={s.pyqSelName} numberOfLines={1}>
              {pyqName ?? pyq}
            </Text>
            {pyqName && <Text style={s.pyqSelId} numberOfLines={1}>{pyq}</Text>}
          </View>
          <TouchableOpacity
            onPress={() => {
              setPyq('');
              setPyqName(null);
              setError(null);
            }}
            disabled={busy}
            hitSlop={10}
            accessibilityLabel="Remove past-paper link"
          >
            <Feather name="x-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TextInput
            value={pyqQuery}
            onChangeText={(v) => {
              setPyqQuery(v);
              setPyqErr(null);
            }}
            editable={!busy}
            placeholder="Search past-paper subjects… (min 2 chars)"
            placeholderTextColor={COLORS.textSubtle}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {pyqSearching && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 6 }} />}
          {pyqErr ? <Text style={s.error}>{pyqErr}</Text> : null}
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
                  <Text style={s.pyqOptName} numberOfLines={1}>{r.name}</Text>
                  <Text style={s.pyqOptId} numberOfLines={1}>
                    {[r.code, r.id].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Feather name="link" size={15} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
        </>
      )}
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
      <AuditLink tool="manage_syllabus" label="View syllabus changes" onNavigate={onClose} />
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
  pyqSel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pyqSelName: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.text },
  pyqSelId: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  pyqOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  pyqOptName: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.text },
  pyqOptId: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle, marginTop: 1 },
  error: { fontFamily: FONTS.bodySemi, fontSize: 12, color: '#b91c1c' },
  hint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', minWidth: 96 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDangerGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#fecaca' },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14 },
});
