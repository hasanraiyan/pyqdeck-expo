import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { COLORS, FONTS } from '../theme/colors';
import {
  ApiError,
  adminDeletePaper,
  adminPaperPages,
  adminSavePaper,
  type PaperPageAsset,
  type PaperStatus,
} from '../api';
import { userMessage } from '../utils/netError';
import { PaperPageEditor } from './PaperPageEditor';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fitLongEdge } from '../admin/pageSize';
import {
  MAX_PAGES,
  addNewPages,
  describeChanges,
  moveSlot,
  removeSlot,
  replaceSlot,
  slotsFromPages,
  summarizeChanges,
  updateNewPage,
  type NewPage,
  type Slot,
} from '../admin/paperEdit';

// Scale a page down before upload (see admin/pageSize.ts). Any failure here
// falls back to the original page, so shrinking can never block an upload.
const shrinkPage = async (page: PaperPageAsset): Promise<PaperPageAsset> => {
  try {
    const probe = await ImageManipulator.manipulate(page.uri).renderAsync();
    const resize = fitLongEdge(probe.width, probe.height);
    if (!resize) return page;
    const ref = await ImageManipulator.manipulate(page.uri).resize(resize).renderAsync();
    const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    return { ...page, uri: out.uri, type: 'image/jpeg' };
  } catch {
    return page;
  }
};

/**
 * In-app paper management for admins (docs/SRS-original-paper-viewer.md,
 * FR-PAPER-15/23/24). Opened from the question list's "Manage paper" entry.
 *
 * The list is the paper's pages, page by page: pages it already has (loaded
 * from the server, with thumbnails) mixed with pages just added from the camera
 * or gallery. Any page can be removed, moved, or replaced; new pages can be
 * cropped or rotated. "Save" sends only the NEW photos and records the whole
 * ordered list, so fixing one page never means re-uploading the rest. A paper
 * that has no pages yet is just an empty list to fill.
 */

const toNewPage = (a: ImagePicker.ImagePickerAsset, index: number): NewPage => ({
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
  const queryClient = useQueryClient();
  const hasPaper = status?.hasOriginal === true;

  // The stored pages, read fresh each time the sheet opens (never cached).
  const pagesKey = ['adminPaperPages', subjectId, year] as const;
  const pagesQ = useQuery({
    queryKey: pagesKey,
    queryFn: () => adminPaperPages(subjectId, year),
    enabled: hasPaper,
    staleTime: 0,
    gcTime: 0,
  });

  const [slots, setSlots] = useState<Slot[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const summary = summarizeChanges(originalIds, slots);
  const busy = saving || removing;
  // With a stored paper, nothing can be edited until its pages have loaded:
  // saving a list that is missing them would delete them.
  const loaded = !hasPaper || !!pagesQ.data;

  // Load the server's pages into the editable list. A reload must never wipe
  // edits in progress, so it only applies when there are none or when we asked
  // for it (after a save, or "Reload").
  const dirtyRef = useRef(false);
  dirtyRef.current = summary.changed;
  const forceReloadRef = useRef(false);
  useEffect(() => {
    const d = pagesQ.data;
    if (!d) return;
    if (dirtyRef.current && !forceReloadRef.current) return;
    forceReloadRef.current = false;
    setSlots(slotsFromPages(d.pages));
    setOriginalIds(d.pages.map((pg) => pg.publicId));
    setBaseUpdatedAt(d.updatedAt);
  }, [pagesQ.data]);

  const reloadFromServer = () => {
    forceReloadRef.current = true;
    setConflict(false);
    setError(null);
    void pagesQ.refetch();
  };

  const discardChanges = () => {
    const d = pagesQ.data;
    setSlots(d ? slotsFromPages(d.pages) : []);
    setError(null);
    setConflict(false);
  };

  // Pick photos. `replaceAt` set: one photo that takes that page's place;
  // otherwise any number, added at the end.
  const pick = async (source: 'camera' | 'gallery', replaceAt?: number) => {
    setError(null);
    setDone(null);
    const replacing = replaceAt !== undefined;
    const room = MAX_PAGES - slots.length;
    if (!replacing && room <= 0) {
      setError(`A paper can have at most ${MAX_PAGES} pages.`);
      return;
    }
    let res: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera permission is needed to scan pages.');
        return;
      }
      // One shot per tap: repeat for multi-page papers, in order.
      res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    } else {
      // No permission request: this opens the system photo picker, which hands
      // back only the chosen images. READ_MEDIA_* is deliberately not declared
      // (Play photo/video policy), so asking for it would always come back denied.
      res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: !replacing,
        selectionLimit: replacing ? 1 : room,
        orderedSelection: true,
        quality: 0.9,
      });
    }
    if (res.canceled) return;
    const images = res.assets.filter((a) => (a.type ?? 'image').startsWith('image'));
    if (images.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    if (replacing) {
      setSlots((prev) => replaceSlot(prev, replaceAt, toNewPage(images[0], replaceAt)));
      // A fresh scan goes straight into crop/rotate so it can be cleaned up.
      if (source === 'camera') setEditing(replaceAt);
    } else {
      const before = slots.length;
      setSlots((prev) =>
        addNewPages(prev, images.map((a, i) => toNewPage(a, before + i)), MAX_PAGES)
      );
      if (source === 'camera') setEditing(before);
    }
  };

  const askReplace = (index: number) => {
    Alert.alert(`Replace page ${index + 1}`, 'Take a new photo or choose one from the gallery.', [
      { text: 'Camera', onPress: () => void pick('camera', index) },
      { text: 'Gallery', onPress: () => void pick('gallery', index) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (busy || !loaded || !summary.changed || slots.length === 0) return;
    setError(null);
    setConflict(false);
    setDone(null);
    setSaving(true);
    setProgress(0);
    try {
      // One at a time: full-size photos are large, so avoid holding many decoded.
      const prepared: Slot[] = [];
      for (const s of slots) {
        prepared.push(s.kind === 'new' ? { kind: 'new', page: await shrinkPage(s.page) } : s);
      }
      const res = await adminSavePaper(subjectId, year, prepared, baseUpdatedAt, setProgress);
      const what = hasPaper ? describeChanges(summary) : '';
      setDone(`Saved: ${res.pages} page${res.pages === 1 ? '' : 's'}${what ? ` (${what})` : ''}.`);
      // Show the server's version of the paper (new ids, new order) next.
      forceReloadRef.current = true;
      // Until the reload lands, show only what was kept and treat it as the new
      // baseline, so no stale "Save changes" button flashes up.
      const kept = prepared.filter((s) => s.kind === 'existing');
      setSlots(kept);
      setOriginalIds(kept.map((s) => (s.kind === 'existing' ? s.publicId : '')));
      onChanged();
      void queryClient.invalidateQueries({ queryKey: pagesKey });
    } catch (e) {
      // Admin-only screen: append the HTTP status and server code so a failure
      // says what happened instead of a generic line.
      const detail =
        e instanceof ApiError && e.status
          ? ` (HTTP ${e.status}${e.code ? `, ${e.code}` : ''})`
          : '';
      if (e instanceof ApiError && e.status === 409) setConflict(true);
      setError(userMessage(e, 'Save failed. Check your connection and try again.') + detail);
    } finally {
      setSaving(false);
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
                setSlots([]);
                setOriginalIds([]);
                setBaseUpdatedAt(null);
                onChanged();
                void queryClient.removeQueries({ queryKey: pagesKey });
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

  const editingSlot = editing != null ? slots[editing] : undefined;
  const editorUri = editingSlot && editingSlot.kind === 'new' ? editingSlot.page.uri : null;
  const allRemoved = hasPaper && loaded && slots.length === 0;

  return (
    <View style={styles.screen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Original paper</Text>
      <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close" disabled={saving}>
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
          {conflict ? (
            <TouchableOpacity onPress={reloadFromServer} hitSlop={8} accessibilityLabel="Reload the paper">
              <Text style={styles.linkText}>Reload</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {done ? (
        <View style={styles.doneBox}>
          <Feather name="check-circle" size={14} color={COLORS.secondary} />
          <Text style={styles.doneText}>{done}</Text>
        </View>
      ) : null}

      {hasPaper && pagesQ.isError ? (
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={14} color={COLORS.primary} />
          <Text style={styles.errorText}>
            {userMessage(pagesQ.error, 'Could not load the stored pages.')}
          </Text>
          <TouchableOpacity onPress={() => void pagesQ.refetch()} hitSlop={8}>
            <Text style={styles.linkText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {hasPaper && pagesQ.isPending ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.primary} size="small" />
          <Text style={styles.hint}>Loading the stored pages…</Text>
        </View>
      ) : null}

      {/* Sources: new pages are added at the end */}
      <View style={styles.sourceRow}>
        <TouchableOpacity
          style={[styles.sourceBtn, !loaded && { opacity: 0.5 }]}
          activeOpacity={0.7}
          onPress={() => void pick('camera')}
          disabled={busy || !loaded}
        >
          <Feather name="camera" size={16} color={COLORS.primary} />
          <Text style={styles.sourceText}>{hasPaper ? 'Add page' : 'Scan page'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sourceBtn, !loaded && { opacity: 0.5 }]}
          activeOpacity={0.7}
          onPress={() => void pick('gallery')}
          disabled={busy || !loaded}
        >
          <Feather name="image" size={16} color={COLORS.primary} />
          <Text style={styles.sourceText}>Gallery</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        Scan captures one page per shot — repeat for multi-page papers. Added pages go to the end; use the
        arrows to move them. Max {MAX_PAGES} pages.
      </Text>

      {/* The pages, page by page */}
      {slots.length > 0 && (
        <View style={styles.reviewWrap}>
          <Text style={styles.reviewTitle}>
            {slots.length} page{slots.length === 1 ? '' : 's'}
            {hasPaper ? ' · ↻ replaces a page, ✕ removes it' : ' ready'} · tap a new page to crop or rotate
          </Text>
          <View style={styles.grid}>
            {slots.map((slot, i) => (
              <View key={slot.kind === 'existing' ? slot.publicId : `${slot.page.uri}-${i}`} style={styles.thumbWrap}>
                {slot.kind === 'new' ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setEditing(i)}
                    style={styles.thumb}
                    accessibilityLabel={`Crop or rotate page ${i + 1}`}
                  >
                    <Image source={{ uri: slot.page.uri }} style={styles.thumb} contentFit="cover" />
                    <View style={styles.thumbEdit}>
                      <Feather name="crop" size={11} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.thumb}>
                    <Image
                      source={{ uri: slot.thumbUrl }}
                      style={styles.thumb}
                      contentFit="cover"
                      cachePolicy="memory"
                    />
                    <TouchableOpacity
                      style={styles.thumbEdit}
                      onPress={() => askReplace(i)}
                      disabled={busy}
                      hitSlop={6}
                      accessibilityLabel={`Replace page ${i + 1}`}
                    >
                      <Feather name="refresh-cw" size={11} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.thumbIndex}>
                  <Text style={styles.thumbIndexText}>{i + 1}</Text>
                </View>
                {hasPaper && slot.kind === 'new' ? (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NEW</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.thumbDelete}
                  onPress={() => setSlots((prev) => removeSlot(prev, i))}
                  disabled={busy}
                  hitSlop={6}
                  accessibilityLabel={`Remove page ${i + 1}`}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
                <View style={styles.thumbMoveRow}>
                  <TouchableOpacity
                    onPress={() => setSlots((prev) => moveSlot(prev, i, -1))}
                    disabled={i === 0 || busy}
                    hitSlop={6}
                  >
                    <Feather name="chevron-up" size={14} color={i === 0 ? COLORS.border : COLORS.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSlots((prev) => moveSlot(prev, i, 1))}
                    disabled={i === slots.length - 1 || busy}
                    hitSlop={6}
                  >
                    <Feather
                      name="chevron-down"
                      size={14}
                      color={i === slots.length - 1 ? COLORS.border : COLORS.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {allRemoved ? (
        <Text style={styles.warnText}>
          Every page is removed. A paper needs at least one page: add one, or use “Remove stored paper”
          below to delete it.
        </Text>
      ) : null}

      {/* Save */}
      {saving ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {summary.added > 0 ? `Uploading… ${Math.round(progress * 100)}%` : 'Saving…'}
          </Text>
        </View>
      ) : summary.changed ? (
        <View style={styles.reviewWrap}>
          <TouchableOpacity
            style={[styles.uploadBtn, (busy || !loaded || slots.length === 0) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={() => void save()}
            disabled={busy || !loaded || slots.length === 0}
          >
            <Feather name="arrow-up-circle" size={16} color="#fff" />
            <Text style={styles.uploadText}>
              {hasPaper
                ? `Save changes · ${describeChanges(summary)}`
                : `Upload ${slots.length} page${slots.length === 1 ? '' : 's'}`}
            </Text>
          </TouchableOpacity>
          {hasPaper ? (
            <TouchableOpacity onPress={discardChanges} disabled={busy} hitSlop={8} style={styles.discardBtn}>
              <Text style={styles.linkText}>Discard changes</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Danger zone */}
      {hasPaper && !saving && (
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
      uri={editorUri}
      pageLabel={editing != null ? `Page ${editing + 1} of ${slots.length}` : ''}
      onCancel={() => setEditing(null)}
      onDone={(uri) => {
        if (editing != null) setSlots((prev) => updateNewPage(prev, editing, uri));
        setEditing(null);
      }}
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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkText: { fontFamily: FONTS.displayBold, fontSize: 12.5, color: COLORS.primary },
  discardBtn: { alignSelf: 'center', paddingVertical: 4 },
  warnText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.primary, lineHeight: 17 },
  newBadge: {
    position: 'absolute',
    left: 4,
    top: 26,
    backgroundColor: COLORS.secondary,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newBadgeText: { fontFamily: FONTS.bodyBold, fontSize: 9, color: '#fff', letterSpacing: 0.5 },
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
