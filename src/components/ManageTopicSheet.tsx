import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { adminSyllabus } from '../api';
import { qk } from '../api/queryKeys';
import { userMessage } from '../utils/netError';
import { deleteConfirmText, parseTopicTitles, validateTopicTitle } from '../admin/syllabusLogic';

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
  const queryClient = useQueryClient();
  const editing = !!topic;
  const [title, setTitle] = useState(topic?.title ?? '');
  const [prompt, setPrompt] = useState(topic?.prompt ?? '');
  const [bulk, setBulk] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = saving || deleting;

  const bulkTitles = editing ? [] : parseTopicTitles(bulk);
  const titleErr = validateTopicTitle(title);
  const canSave = editing
    ? !busy && !titleErr && (title.trim() !== topic!.title || prompt !== (topic!.prompt ?? ''))
    : !busy && (bulkTitles.length > 0 || !titleErr);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.syllabusSubject(subjectId) });
  };

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
      await invalidate();
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
              await invalidate();
              onSaved();
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

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{editing ? 'EDIT TOPIC' : 'ADD TOPIC'}</Text>
          <Text style={s.title} numberOfLines={2}>
            {editing ? topic!.title : moduleTitle}
          </Text>
          {!editing && <Text style={s.sub}>in {moduleTitle}</Text>}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close topic editor">
          <Feather name="x" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={s.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setError(null);
        }}
        editable={!busy}
        placeholder="e.g. Subnetting"
        placeholderTextColor={COLORS.textSubtle}
        style={s.input}
        autoCapitalize="sentences"
      />
      {editing ? (
        <>
          <Text style={s.label}>Ask AI prompt override (optional)</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            editable={!busy}
            placeholder="Leave empty for the default prompt"
            placeholderTextColor={COLORS.textSubtle}
            style={s.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.hint}>Renaming keeps the topic id — PYQ links and student progress survive.</Text>
        </>
      ) : (
        <>
          <Text style={s.label}>Or paste many (one per line)</Text>
          <TextInput
            value={bulk}
            onChangeText={(v) => {
              setBulk(v);
              setError(null);
            }}
            editable={!busy}
            multiline
            placeholder={'Flow control\nError control\nSliding window'}
            placeholderTextColor={COLORS.textSubtle}
            style={[s.input, { minHeight: 88, textAlignVertical: 'top' }]}
          />
          {bulkTitles.length > 0 && <Text style={s.hint}>{bulkTitles.length} topics will be added.</Text>}
        </>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.actions}>
        {editing ? (
          <TouchableOpacity
            onPress={doDelete}
            disabled={busy}
            style={[s.btn, s.btnDangerGhost, busy && { opacity: 0.4 }]}
            accessibilityLabel="Delete topic"
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
          accessibilityLabel={editing ? 'Save topic' : 'Add topic'}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, { color: '#fff' }]}>{editing ? 'Save' : `Add${bulkTitles.length > 1 ? ` ${(!titleErr ? 1 : 0) + bulkTitles.length}` : ''}`}</Text>}
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
  hint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
  error: { fontFamily: FONTS.bodySemi, fontSize: 12, color: '#b91c1c' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', minWidth: 96 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDangerGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#fecaca' },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14 },
});
