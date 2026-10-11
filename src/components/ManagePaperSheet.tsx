import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { COLORS, FONTS } from '../theme/colors';
import {
  adminDeletePaper,
  adminUploadPaper,
  type PaperPageAsset,
  type PaperStatus,
} from '../api';
import { userMessage } from '../utils/netError';
import { PaperPageEditor } from './PaperPageEditor';

/**
 * In-app paper management for admins (docs/SRS-original-paper-viewer.md,
 * FR-PAPER-15/23/24). Opened from the question list's "Manage paper" entry:
 * upload-new when no paper exists, otherwise page count + upload date with
 * replace and remove. Sources are camera capture ("scan", one page per shot)
 * and gallery multi-pick; picked pages are reviewed, reordered and deleted
 * before upload, which reports progress and flips `hasOriginal` on success.
 */

const MAX_PAGES = 20;

const toAsset = (a: ImagePicker.ImagePickerAsset, index: number): PaperPageAsset => ({
  uri: a.uri,
  name: a.fileName || `page-${index + 1}.jpg`,
  type: a.mimeType || 'image/jpeg',
});

export const ManagePaperSheet = ({
  subjectId,
  subjectName,
  year,
  status,
  onChanged,
  onClose,
}: {
  subjectId: string;
  subjectName?: string;
  year: number;
  status?: PaperStatus;
  onChanged: () => void;
  onClose: () => void;
}) => {
  const [picked, setPicked] = useState<PaperPageAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const hasPaper = status?.hasOriginal === true;
  const busy = uploading || removing;

  const pickFromGallery = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Gallery permission is needed to pick scan images.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PAGES,
      orderedSelection: true,
      quality: 0.9,
    });
    if (!res.canceled) appendAssets(res.assets);
  };

  const scanWithCamera = async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is needed to scan pages.');
      return;
    }
    // One shot per tap: repeat for multi-page scans, in order.
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled) {
      const before = picked.length;
      appendAssets(res.assets);
      // Straight into crop/rotate so the fresh scan can be cleaned up.
      if (before < MAX_PAGES) setEditing(before);
    }
  };

  const appendAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const images = assets.filter((a) => (a.type ?? 'image').startsWith('image'));
    setPicked((prev) => {
      const next = [...prev];
      for (const a of images) {
        if (next.length >= MAX_PAGES) break;
        next.push(toAsset(a, next.length));
      }
      return next;
    });
    Haptics.selectionAsync().catch(() => {});
  };

  const move = (index: number, delta: -1 | 1) => {
    setPicked((prev) => {
      const next = [...prev];
      const j = index + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const replaceEdited = (index: number, uri: string) => {
    setPicked((prev) =>
      prev.map((p, i) => (i === index ? { ...p, uri, name: `page-${i + 1}.jpg`, type: 'image/jpeg' } : p))
    );
    setEditing(null);
  };

  const removePicked = (index: number) => {
    setPicked((prev) => prev.filter((_, i) => i !== index));
  };

  const upload = async () => {
    if (picked.length === 0 || busy) return;
    setError(null);
    setDone(null);
    setUploading(true);
    setProgress(0);
    try {
      const res = await adminUploadPaper(subjectId, year, picked, setProgress);
      setPicked([]);
      setDone(
        res.replaced
          ? `Replaced with ${res.pages} page${res.pages === 1 ? '' : 's'}.`
          : `Uploaded ${res.pages} page${res.pages === 1 ? '' : 's'}.`
      );
      onChanged();
    } catch (e) {
      setError(userMessage(e, 'Upload failed. Check your connection and try again.'));
    } finally {
      setUploading(false);
    }
  };

  const remove = () => {
    Alert.alert(
      'Remove this paper?',
      `The ${year} scanned paper (${status?.pages ?? 0} pages) will be deleted everywhere. Students keep the retyped questions. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setError(null);
              setDone(null);
              setRemoving(true);
              try {
                await adminDeletePaper(subjectId, year);
                setDone('Paper removed.');
                onChanged();
              } catch (e) {
                setError(userMessage(e, 'Remove failed. Please try again.'));
              } finally {
                setRemoving(false);
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Original paper</Text>
      <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close" disabled={uploading}>
        <Feather name="x" size={22} color={COLORS.text} />
      </TouchableOpacity>
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>MANAGE PAPER</Text>
      <Text style={styles.title}>
        {subjectName || 'Subject'} · {year}
      </Text>
      <Text style={styles.sub}>
        {hasPaper
          ? `${status?.pages ?? 0} page${(status?.pages ?? 0) === 1 ? '' : 's'} stored${
              status?.updatedAt ? ` · updated ${new Date(status.updatedAt).toLocaleDateString()}` : ''
            }.`
          : 'No scanned paper stored for this year yet.'}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color={COLORS.primary} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {done ? (
        <View style={styles.doneBox}>
          <Feather name="check-circle" size={14} color={COLORS.secondary} />
          <Text style={styles.doneText}>{done}</Text>
        </View>
      ) : null}

      {/* Sources */}
      <View style={styles.sourceRow}>
        <TouchableOpacity style={styles.sourceBtn} activeOpacity={0.7} onPress={scanWithCamera} disabled={busy}>
          <Feather name="camera" size={16} color={COLORS.primary} />
          <Text style={styles.sourceText}>Scan page</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sourceBtn} activeOpacity={0.7} onPress={pickFromGallery} disabled={busy}>
          <Feather name="image" size={16} color={COLORS.primary} />
          <Text style={styles.sourceText}>Gallery</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Scan captures one page per shot — repeat for multi-page papers. Gallery picks stay in order, max {MAX_PAGES} pages.
      </Text>

      {/* Review */}
      {picked.length > 0 && (
        <View style={styles.reviewWrap}>
          <Text style={styles.reviewTitle}>
            {picked.length} page{picked.length === 1 ? '' : 's'} ready · tap a page to crop or rotate
          </Text>
          <View style={styles.grid}>
            {picked.map((p, i) => (
              <View key={`${p.uri}-${i}`} style={styles.thumbWrap}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setEditing(i)}
                  style={styles.thumb}
                  accessibilityLabel={`Crop or rotate page ${i + 1}`}
                >
                  <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                  <View style={styles.thumbEdit}>
                    <Feather name="crop" size={11} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={styles.thumbIndex}>
                  <Text style={styles.thumbIndexText}>{i + 1}</Text>
                </View>
                <TouchableOpacity
                  style={styles.thumbDelete}
                  onPress={() => removePicked(i)}
                  hitSlop={6}
                  accessibilityLabel={`Remove page ${i + 1}`}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
                <View style={styles.thumbMoveRow}>
                  <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6}>
                    <Feather name="chevron-up" size={14} color={i === 0 ? COLORS.border : COLORS.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => move(i, 1)}
                    disabled={i === picked.length - 1}
                    hitSlop={6}
                  >
                    <Feather
                      name="chevron-down"
                      size={14}
                      color={i === picked.length - 1 ? COLORS.border : COLORS.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          {uploading ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>Uploading… {Math.round(progress * 100)}%</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.7} onPress={upload} disabled={busy}>
              <Feather name="arrow-up-circle" size={16} color="#fff" />
              <Text style={styles.uploadText}>
                {hasPaper ? `Replace with ${picked.length} page${picked.length === 1 ? '' : 's'}` : `Upload ${picked.length} page${picked.length === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Danger zone */}
      {hasPaper && !uploading && (
        <TouchableOpacity
          style={styles.removeBtn}
          activeOpacity={0.7}
          onPress={remove}
          disabled={busy}
        >
          {removing ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <Feather name="trash-2" size={14} color={COLORS.primary} />
              <Text style={styles.removeText}>Remove stored paper</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
        <Text style={styles.closeText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
    <PaperPageEditor
      uri={editing != null ? picked[editing]?.uri ?? null : null}
      pageLabel={editing != null ? `Page ${editing + 1} of ${picked.length}` : ''}
      onCancel={() => setEditing(null)}
      onDone={(uri) => editing != null && replaceEdited(editing, uri)}
    />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  scroll: { flex: 1 },
  thumbEdit: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 4,
  },
  body: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 32, gap: 10 },
  kicker: {
    fontFamily: FONTS.displayBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.primary,
  },
  title: { fontFamily: FONTS.displayBold, fontSize: 19, color: COLORS.text },
  sub: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.primary },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 10,
    padding: 10,
  },
  doneText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.secondary },
  sourceRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
  },
  sourceText: { fontFamily: FONTS.displayBold, fontSize: 13.5, color: COLORS.text },
  hint: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.textMuted, lineHeight: 16 },
  reviewWrap: { gap: 10, marginTop: 4 },
  reviewTitle: { fontFamily: FONTS.displayBold, fontSize: 13, color: COLORS.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: {
    width: '31.5%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumb: { width: '100%', height: '100%' },
  thumbIndex: {
    position: 'absolute',
    left: 4,
    top: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  thumbIndexText: { fontFamily: FONTS.bodyBold, fontSize: 10, color: '#fff' },
  thumbDelete: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMoveRow: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  progressWrap: { gap: 6 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.cardSecondary,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.secondary, borderRadius: 4 },
  progressText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  uploadText: { fontFamily: FONTS.displayBold, fontSize: 14, color: '#fff' },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 6,
  },
  removeText: { fontFamily: FONTS.displayBold, fontSize: 13, color: COLORS.primary },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  closeText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.textMuted },
});
