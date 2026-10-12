import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../theme/colors';
import { ApiError, adminNotes } from '../api';
import { qk } from '../api/queryKeys';
import { userMessage } from '../utils/netError';
import { pickNotesWrite } from '../admin/syllabusLogic';
import { NativeContentRenderer } from './NativeContentRenderer';
import { FaqAccordion } from './FaqAccordion';
import { extractFaqsFromNotes } from '../utils/faqParser';

/**
 * Inline notes editor for admins (SRS-admin-syllabus-notes-app.md ASN-FR-20–24).
 * Opened from TopicNotesScreen's pencil button — same screen students read on,
 * no separate admin browser. Edit/Preview tabs share the student renderer, so
 * parity is guaranteed. Save picks update vs patch-append via pickNotesWrite;
 * Clear (delete-to-unset) is behind a confirm and keeps the topic.
 */
export const ManageNotesSheet = ({
  subjectId,
  moduleId,
  topicId,
  topicTitle,
  initialNotes,
  onSaved,
  onClose,
}: {
  subjectId: string;
  moduleId: string;
  topicId: string;
  topicTitle: string;
  initialNotes: string;
  onSaved: () => void;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [text, setText] = useState(initialNotes);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || clearing;
  const dirty = text !== initialNotes;
  const canSave = dirty && text.trim().length > 0 && !busy;

  const insert = (snippet: string) => {
    setText((t) => (t ? `${t}\n${snippet}` : snippet));
  };

  const doSave = async (overwrite = false) => {
    if (!canSave && !overwrite) return;
    setSaving(true);
    setError(null);
    try {
      const kind = pickNotesWrite(initialNotes, text);
      if (kind === 'none') {
        onClose();
        return;
      }
      if (kind === 'patch-append') {
        await adminNotes({
          action: 'patch',
          subject: subjectId,
          module: moduleId,
          topic: topicId,
          append: text.slice(initialNotes.length),
        });
      } else if (kind === 'patch-replace') {
        // Single-hunk replace: find the removed slice exactly. Fall back to
        // full update when the hunk cannot be isolated (patch is exact-match).
        let p = 0;
        while (p < initialNotes.length && p < text.length && initialNotes[p] === text[p]) p++;
        let s = 0;
        while (
          s < initialNotes.length - p &&
          s < text.length - p &&
          initialNotes[initialNotes.length - 1 - s] === text[text.length - 1 - s]
        ) {
          s++;
        }
        const find = initialNotes.slice(p, initialNotes.length - s);
        const replace = text.slice(p, text.length - s);
        try {
          await adminNotes({
            action: 'patch',
            subject: subjectId,
            module: moduleId,
            topic: topicId,
            edits: [{ find, replace }],
          });
        } catch (e) {
          if (e instanceof ApiError && e.status === 400) {
            await adminNotes({ action: 'update', subject: subjectId, module: moduleId, topic: topicId, notes: text });
          } else {
            throw e;
          }
        }
      } else {
        await adminNotes({ action: 'update', subject: subjectId, module: moduleId, topic: topicId, notes: text });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // Notes are uncached by design — invalidate so the reader refetches live.
      await queryClient.invalidateQueries({ queryKey: qk.topicNotes(subjectId, topicId) });
      await queryClient.invalidateQueries({ queryKey: qk.syllabusSubject(subjectId) });
      onSaved();
    } catch (e: any) {
      setError(userMessage(e, 'Could not save notes.'));
    } finally {
      setSaving(false);
    }
  };

  const doClear = () => {
    Alert.alert(
      'Clear notes?',
      'Students will no longer see a notes icon on this topic. The topic itself stays.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Clear notes',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            setError(null);
            try {
              await adminNotes({ action: 'delete', subject: subjectId, module: moduleId, topic: topicId });
              await queryClient.invalidateQueries({ queryKey: qk.topicNotes(subjectId, topicId) });
              await queryClient.invalidateQueries({ queryKey: qk.syllabusSubject(subjectId) });
              onSaved();
            } catch (e: any) {
              setError(userMessage(e, 'Could not clear notes.'));
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const preview = extractFaqsFromNotes(text);

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>EDIT NOTES</Text>
          <Text style={s.title} numberOfLines={2}>
            {topicTitle}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close notes editor">
          <Feather name="x" size={22} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(['edit', 'preview'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[s.tab, tab === t && s.tabActive]}
            accessibilityRole="tab"
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'edit' ? 'Edit' : 'Preview'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'edit' ? (
        <>
          <View style={s.toolbar}>
            {[
              { label: 'B', fn: () => insert('****') },
              { label: 'List', fn: () => insert('\n- ') },
              { label: '$math$', fn: () => insert('$  $') },
              { label: '$$block$$', fn: () => insert('\n$$$$\n\n$$$$\n') },
              { label: 'mermaid', fn: () => insert('\n```mermaid\ngraph TD\n  A-->B\n```\n') },
              { label: 'FAQ', fn: () => insert('\n## Frequently Asked Questions\n\n### Q: \n\n') },
            ].map((b) => (
              <TouchableOpacity key={b.label} onPress={b.fn} style={s.tool} disabled={busy}>
                <Text style={s.toolText}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError(null);
            }}
            multiline
            editable={!busy}
            placeholder="Write markdown — LaTeX $...$, Mermaid blocks, FAQ at the bottom."
            placeholderTextColor={COLORS.textSubtle}
            style={s.input}
            textAlignVertical="top"
            autoCapitalize="sentences"
          />
          <Text style={s.count}>
            {text.length} chars · {text.split('\n').length} lines
            {text.trim().length === 0 ? ' · empty — use Clear to remove' : ''}
          </Text>
        </>
      ) : (
        <ScrollView style={s.preview} contentContainerStyle={{ paddingBottom: 24 }}>
          {text.trim() ? (
            <>
              <NativeContentRenderer content={preview.notesBody} fontSize={15} />
              {preview.faqs.length > 0 && <FaqAccordion items={preview.faqs} />}
            </>
          ) : (
            <Text style={s.count}>Nothing to preview.</Text>
          )}
        </ScrollView>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
      {!busy && !dirty ? <Text style={s.count}>No changes.</Text> : null}

      <View style={s.actions}>
        <TouchableOpacity
          onPress={doClear}
          disabled={busy || !initialNotes}
          style={[s.btn, s.btnGhost, (busy || !initialNotes) && { opacity: 0.4 }]}
          accessibilityLabel="Clear notes"
        >
          <Text style={[s.btnText, { color: COLORS.textMuted }]}>Clear</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => doSave()}
          disabled={!canSave}
          style={[s.btn, s.btnPrimary, !canSave && { opacity: 0.45 }]}
          accessibilityLabel="Save notes"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={[s.btnText, { color: '#fff' }]}>Save</Text>}
        </TouchableOpacity>
      </View>
      <Text style={s.hint}>Offline edits are blocked — connect to save. Nothing is stored on this phone.</Text>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, color: COLORS.primary },
  title: { fontFamily: FONTS.displayBold, fontSize: 17, color: COLORS.text, marginTop: 2 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
  tabTextActive: { color: '#fff' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tool: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSecondary,
  },
  toolText: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.text },
  input: {
    minHeight: 220,
    maxHeight: 360,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  preview: { maxHeight: 380, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12 },
  count: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
  error: { fontFamily: FONTS.bodySemi, fontSize: 12, color: '#b91c1c' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', minWidth: 96 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border },
  btnText: { fontFamily: FONTS.bodySemi, fontSize: 14 },
  hint: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSubtle },
});
