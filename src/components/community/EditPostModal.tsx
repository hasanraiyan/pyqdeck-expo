import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { editPost } from '../../community/actions';
import type { CommunityPost } from '../../types/community';

interface Props {
  post: CommunityPost;
  visible: boolean;
  onClose: () => void;
}

/** Edit the text of your own post. Images keep as they are; the edit is checked again before it replaces the old text. */
export const EditPostModal: React.FC<Props> = ({ post, visible, onClose }) => {
  const insets = useSafeAreaInsets();
  // Edit the text as typed, not the version with short links substituted in.
  const original = post.rawBody ?? post.body;
  const [text, setText] = useState(original);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setText(original);
  }, [visible, original]);

  const changed = text.trim() !== original.trim();
  const canSave = changed && (text.trim().length > 0 || post.attachments.length > 0) && !saving;

  const save = async () => {
    setSaving(true);
    const updated = await editPost(post.id, text.trim());
    setSaving(false);
    if (updated) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top || 16, paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityLabel="Cancel editing">
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit post</Text>
          <TouchableOpacity
            onPress={save}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            accessibilityLabel="Save changes"
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          maxLength={5000}
          placeholder="Update your post"
          placeholderTextColor={COLORS.textSubtle}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{text.length}/5000</Text>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  cancel: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.textMuted },
  saveBtn: {
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: '#ffffff' },
  input: {
    flex: 1,
    padding: 16,
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.text,
  },
  counter: { textAlign: 'right', paddingHorizontal: 16, paddingBottom: 8, fontSize: 12, color: COLORS.textSubtle },
});
