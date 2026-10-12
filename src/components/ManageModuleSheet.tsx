import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { adminSyllabus } from '../api';
import { qk } from '../api/queryKeys';
import { userMessage } from '../utils/netError';
import { deleteConfirmText, validateModuleTitle } from '../admin/syllabusLogic';

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
  const queryClient = useQueryClient();
  const editing = !!module;
  const [number, setNumber] = useState(String(module?.number ?? nextNumber));
  const [title, setTitle] = useState(module?.title ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || deleting;

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
      await queryClient.invalidateQueries({ queryKey: qk.syllabusSubject(subjectId) });
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
              await queryClient.invalidateQueries({ queryKey: qk.syllabusSubject(subjectId) });
              onSaved();
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
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{editing ? 'EDIT MODULE' : 'ADD MODULE'}</Text>
          <Text style={s.title} numberOfLines={2}>
            {editing ? module!.title : 'New module'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close module editor">
          <Feather name="x" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={s.label}>Number</Text>
      <TextInput
        value={number}
        onChangeText={(v) => {
          setNumber(v.replace(/[^0-9]/g, ''));
          setError(null);
        }}
        editable={!busy}
        keyboardType="number-pad"
        style={s.input}
      />
      {numErr ? <Text style={s.error}>{numErr}</Text> : null}

      <Text style={s.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. Network Layer"
        placeholderTextColor={COLORS.textSubtle}
        style={s.input}
        autoCapitalize="sentences"
      />
      {titleErr && title.length > 0 ? <Text style={s.error}>{titleErr}</Text> : null}

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.actions}>
        {editing ? (
          <TouchableOpacity
            onPress={doDelete}
            disabled={busy}
            style={[s.btn, s.btnDangerGhost, busy && { opacity: 0.4 }]}
            accessibilityLabel="Delete module"
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
          accessibilityLabel={editing ? 'Save module' : 'Add module'}
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
  error: { fontFamily: FONTS.bodySemi, fontSize: 12, color: '#b91c1c' },
  hint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', minWidth: 96 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDangerGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#fecaca' },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14 },
});
