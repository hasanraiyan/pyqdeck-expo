import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS, SHADOWS } from '../theme/colors';
import { useDialogLayout } from '../utils/dialog';
import { submitPaperContribution } from '../api';

export interface SelectedFileItem {
  id: string;
  uri: string;
  name: string;
  type: 'image' | 'pdf';
  size?: number;
}

interface UploadPaperModalProps {
  visible: boolean;
  onClose: () => void;
  initialSubjectName?: string;
  initialYear?: number | string;
}

export const UploadPaperModal: React.FC<UploadPaperModalProps> = ({
  visible,
  onClose,
  initialSubjectName = '',
  initialYear = '',
}) => {
  const insets = useSafeAreaInsets();
  const dlg = useDialogLayout();

  const [subjectName, setSubjectName] = useState(initialSubjectName);
  const [year, setYear] = useState(initialYear ? String(initialYear) : '');
  const [files, setFiles] = useState<SelectedFileItem[]>([]);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);

  // The keyboard already covers the bottom inset, so drop it while typing
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Sync initial values when sheet opens
  useEffect(() => {
    if (visible) {
      setSubjectName(initialSubjectName);
      setYear(initialYear ? String(initialYear) : '');
      setFiles([]);
      setUploadStatus('idle');
      setUploadProgress(0);
    }
  }, [visible, initialSubjectName, initialYear]);

  // Pick via Camera
  const handlePickCamera = async () => {
    try {
      Haptics.selectionAsync();
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Needed', 'Camera permission is required to photograph question papers.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newItem: SelectedFileItem = {
          id: `cam-${Date.now()}-${Math.random()}`,
          uri: asset.uri,
          name: asset.fileName || `Page-${files.length + 1}.jpg`,
          type: 'image',
          size: asset.fileSize,
        };
        setFiles((prev) => [...prev, newItem]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open camera.');
    }
  };

  // Pick via Gallery
  const handlePickGallery = async () => {
    try {
      Haptics.selectionAsync();
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Needed', 'Gallery permission is required to select paper images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets) {
        const newItems: SelectedFileItem[] = result.assets.map((asset, i) => {
          // Detect extension from asset.mimeType or asset.uri
          let ext = 'jpg';
          if (asset.mimeType?.includes('png') || asset.uri.toLowerCase().endsWith('.png')) ext = 'png';
          else if (asset.mimeType?.includes('webp') || asset.uri.toLowerCase().endsWith('.webp')) ext = 'webp';
          else if (asset.mimeType?.includes('pdf') || asset.uri.toLowerCase().endsWith('.pdf')) ext = 'pdf';

          const defaultName = `Page-${files.length + i + 1}.${ext}`;
          return {
            id: `gal-${Date.now()}-${i}-${Math.random()}`,
            uri: asset.uri,
            name: asset.fileName || defaultName,
            type: ext === 'pdf' ? 'pdf' : 'image',
            size: asset.fileSize,
          };
        });
        setFiles((prev) => [...prev, ...newItems]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pick from gallery.');
    }
  };

  // Pick PDF Document
  const handlePickPdf = async () => {
    try {
      Haptics.selectionAsync();
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newItem: SelectedFileItem = {
          id: `pdf-${Date.now()}-${Math.random()}`,
          uri: asset.uri,
          name: asset.name || 'exam-paper.pdf',
          type: 'pdf',
          size: asset.size,
        };
        setFiles((prev) => [...prev, newItem]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not pick PDF file.');
    }
  };

  const handleRemoveFile = (id: string) => {
    Haptics.selectionAsync();
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Real upload to POST /api/contributions/submit
  const handleUpload = async () => {
    if (files.length === 0) {
      Alert.alert('No Paper Attached', 'Please take photos or select a PDF of the question paper.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUploadStatus('uploading');
    setUploadProgress(5);

    try {
      // Map SelectedFileItem → { uri, name, type, size } for the API
      const apiFiles = files.map((f, idx) => {
        const isPdf = f.type === 'pdf' || f.name.toLowerCase().endsWith('.pdf');
        let mime = 'image/jpeg';
        if (isPdf) mime = 'application/pdf';
        else if (f.name.toLowerCase().endsWith('.png')) mime = 'image/png';
        else if (f.name.toLowerCase().endsWith('.webp')) mime = 'image/webp';
        else if (f.name.toLowerCase().endsWith('.heic')) mime = 'image/heic';

        return {
          uri: f.uri,
          name: f.name || (isPdf ? `paper_${idx + 1}.pdf` : `page_${idx + 1}.jpg`),
          type: mime,
          size: f.size,
        };
      });

      await submitPaperContribution({
        files: apiFiles,
        subjectName: subjectName.trim() || undefined,
        year: year.trim() || undefined,
        onProgress: (pct) => {
          setUploadProgress(pct);
        },
      });

      setUploadProgress(100);
      setUploadStatus('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setUploadStatus('idle');
      setUploadProgress(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Upload Failed',
        err?.message || 'Something went wrong while submitting. Please check your network and try again.'
      );
    }
  };

  const handleReset = () => {
    setSubjectName(initialSubjectName);
    setYear(initialYear ? String(initialYear) : '');
    setFiles([]);
    setUploadStatus('idle');
    setUploadProgress(0);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const displayTitle = subjectName.trim()
    ? `${subjectName.trim()}${year.trim() ? ` (${year.trim()})` : ''}`
    : year.trim()
      ? `${year.trim()} Exam Paper`
      : 'Question Paper';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={dlg.animationType}
      statusBarTranslucent
      onRequestClose={uploadStatus === 'uploading' ? undefined : onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.keyboardRoot}
      >
        <View style={[styles.backdrop, dlg.overlay]}>
          {/* Tap outside to dismiss */}
          <TouchableWithoutFeedback onPress={uploadStatus === 'uploading' ? undefined : onClose}>
            <View style={styles.backdropTouchArea} />
          </TouchableWithoutFeedback>

          {/* Bottom Sheet Card */}
          <View
            style={[
              styles.sheetContainer,
              dlg.sheet,
              { paddingBottom: keyboardOpen ? 0 : Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Drag Handle Indicator */}
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.iconCircle}>
                  <Feather name="upload-cloud" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Upload Question Paper</Text>
                  <Text style={styles.subtitle}>
                    Contribute exam papers for your college batch
                  </Text>
                </View>
              </View>
              {uploadStatus !== 'uploading' && (
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.closeBtn}
                  accessibilityLabel="Close bottom sheet"
                >
                  <Feather name="x" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Body */}
            {uploadStatus === 'success' ? (
              /* Success View */
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Feather name="check" size={30} color="#ffffff" />
                </View>
                <Text style={styles.successTitle}>Paper Uploaded!</Text>
                <Text style={styles.successDesc}>
                  Thank you for contributing{' '}
                  <Text style={{ fontFamily: FONTS.bodyBold, color: COLORS.text }}>
                    {displayTitle}
                  </Text>
                  . The paper will be verified and made available for students shortly.
                </Text>

                <View style={styles.successButtonRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    activeOpacity={0.7}
                    onPress={handleReset}
                  >
                    <Feather name="plus" size={15} color={COLORS.text} />
                    <Text style={styles.secondaryBtnText}>Upload Another</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    activeOpacity={0.7}
                    onPress={onClose}
                  >
                    <Text style={styles.primaryBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Form View */
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {/* Field 1: Exam Year (Numeric TextInput, Optional) */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Exam Year</Text>
                    <Text style={styles.optionalBadge}>Optional</Text>
                  </View>
                  <View style={styles.inputWrapper}>
                    <Feather name="calendar" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={year}
                      onChangeText={setYear}
                      placeholder="e.g. 2024"
                      placeholderTextColor={COLORS.textSubtle}
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={uploadStatus !== 'uploading'}
                    />
                  </View>
                </View>

                {/* Field 2: Subject Name (TextInput, Optional) */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Subject Name</Text>
                    <Text style={styles.optionalBadge}>Optional</Text>
                  </View>
                  <View style={styles.inputWrapper}>
                    <Feather name="book-open" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={subjectName}
                      onChangeText={setSubjectName}
                      placeholder="e.g. Computer Networks, Microprocessors"
                      placeholderTextColor={COLORS.textSubtle}
                      editable={uploadStatus !== 'uploading'}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Attachment Cards */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Attach Exam Paper</Text>
                    <Text style={styles.requiredBadge}>Required</Text>
                  </View>
                  <View style={styles.attachCardRow}>
                    <TouchableOpacity
                      style={styles.attachCard}
                      activeOpacity={0.7}
                      onPress={handlePickCamera}
                      disabled={uploadStatus === 'uploading'}
                    >
                      <View style={styles.attachCardIconCircle}>
                        <Feather name="camera" size={18} color={COLORS.primary} />
                      </View>
                      <Text style={styles.attachCardTitle}>Camera</Text>
                      <Text style={styles.attachCardSub}>Take photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.attachCard}
                      activeOpacity={0.7}
                      onPress={handlePickGallery}
                      disabled={uploadStatus === 'uploading'}
                    >
                      <View style={styles.attachCardIconCircle}>
                        <Feather name="image" size={18} color={COLORS.primary} />
                      </View>
                      <Text style={styles.attachCardTitle}>Gallery</Text>
                      <Text style={styles.attachCardSub}>Pick images</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.attachCard}
                      activeOpacity={0.7}
                      onPress={handlePickPdf}
                      disabled={uploadStatus === 'uploading'}
                    >
                      <View style={styles.attachCardIconCircle}>
                        <Feather name="file-text" size={18} color={COLORS.primary} />
                      </View>
                      <Text style={styles.attachCardTitle}>PDF File</Text>
                      <Text style={styles.attachCardSub}>Select PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Attached Files List */}
                {files.length > 0 && (
                  <View style={styles.fileListSection}>
                    <Text style={styles.filesCountLabel}>
                      Attached ({files.length} {files.length === 1 ? 'file' : 'files'}):
                    </Text>
                    <View style={styles.filesContainer}>
                      {files.map((file) => (
                        <View key={file.id} style={styles.fileItemRow}>
                          {file.type === 'pdf' ? (
                            <View style={styles.pdfIconBox}>
                              <Feather name="file-text" size={16} color="#ffffff" />
                            </View>
                          ) : (
                            <Image source={{ uri: file.uri }} style={styles.fileThumb} />
                          )}
                          <View style={styles.fileMeta}>
                            <Text style={styles.fileName} numberOfLines={1}>
                              {file.name}
                            </Text>
                            <Text style={styles.fileSize}>
                              {file.type.toUpperCase()}{file.size ? ` · ${formatFileSize(file.size)}` : ''}
                            </Text>
                          </View>
                          {uploadStatus !== 'uploading' && (
                            <TouchableOpacity
                              onPress={() => handleRemoveFile(file.id)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={styles.removeFileBtn}
                              accessibilityLabel={`Remove ${file.name}`}
                            >
                              <Feather name="trash-2" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Upload Progress Bar (when uploading) */}
                {uploadStatus === 'uploading' && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                    </View>
                    <View style={styles.progressRow}>
                      <Text style={styles.progressText}>Uploading paper files...</Text>
                      <Text style={styles.progressPct}>{uploadProgress}%</Text>
                    </View>
                  </View>
                )}

                {/* Submit Button */}
                <View style={styles.footerRow}>
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      (uploadStatus === 'uploading' || files.length === 0) && styles.submitBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleUpload}
                    disabled={uploadStatus === 'uploading' || files.length === 0}
                  >
                    {uploadStatus === 'uploading' ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Feather name="upload" size={16} color="#ffffff" />
                        <Text style={styles.submitBtnText}>Submit Paper</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 48, 0.55)',
    justifyContent: 'flex-end',
  },
  backdropTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    maxWidth: 540,
    alignSelf: 'center',
    maxHeight: '90%',
    ...SHADOWS.subtle,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: FONTS.bodySemi,
    color: COLORS.text,
  },
  optionalBadge: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: COLORS.textSubtle,
  },
  requiredBadge: {
    fontSize: 11,
    fontFamily: FONTS.bodySemi,
    color: COLORS.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  attachCardRow: {
    flexDirection: 'row',
    gap: 10,
  },
  attachCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  attachCardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  attachCardTitle: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: COLORS.text,
  },
  attachCardSub: {
    fontSize: 10,
    fontFamily: FONTS.body,
    color: COLORS.textSubtle,
    marginTop: 2,
  },
  fileListSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  filesCountLabel: {
    fontSize: 12,
    fontFamily: FONTS.bodySemi,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  filesContainer: {
    gap: 8,
  },
  fileItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 8,
  },
  pdfIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileThumb: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardSecondary,
  },
  fileMeta: {
    flex: 1,
    marginLeft: 10,
  },
  fileName: {
    fontSize: 13,
    fontFamily: FONTS.bodySemi,
    color: COLORS.text,
  },
  fileSize: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: COLORS.textSubtle,
    marginTop: 2,
  },
  removeFileBtn: {
    padding: 6,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  progressText: {
    fontSize: 12,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
  },
  progressPct: {
    fontSize: 12,
    fontFamily: FONTS.bodyBold,
    color: COLORS.primary,
  },
  footerRow: {
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: FONTS.bodyBold,
  },
  successContainer: {
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 18,
    fontFamily: FONTS.displayBold,
    color: COLORS.text,
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 13,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
  successButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.cardSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodySemi,
    color: COLORS.text,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
    color: '#ffffff',
  },
});
