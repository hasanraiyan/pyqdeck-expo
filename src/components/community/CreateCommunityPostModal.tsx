import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/expo';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { CommunityAttachment } from '../../types/community';
import { startPostUpload } from '../../community/uploads';
import { ImageCropEditor } from '../ImageCropEditor';

import { enableLayoutAnimation } from '../../utils/layoutAnimation';

enableLayoutAnimation();

const MAX_ATTACHMENTS = 5;
// Images only for now: the community service stores no PDFs yet.
const ALLOW_PDF = false;
const POPULAR_TAGS = ['Doubt', 'Notes', 'PYQ', 'BEU', 'ExamPrep', 'Solutions'];

interface CreateCommunityPostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated?: (postId: string) => void;
}

export const CreateCommunityPostModal: React.FC<CreateCommunityPostModalProps> = ({
  visible,
  onClose,
  onPostCreated,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<CommunityAttachment[]>([]);
  const [editingImage, setEditingImage] = useState<CommunityAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardSpace = useRef(new Animated.Value(0)).current;

  // Resolve author details from Clerk user or fallback to student profile
  const authorName =
    user?.fullName ||
    (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'You (Student)');
  const authorAvatarUrl = user?.imageUrl;
  const authorInitial = (user?.firstName?.[0] || authorName[0] || 'Y').toUpperCase();

  // Filter out any hashtag that is already used in the post body
  const availableTags = useMemo(() => {
    const lowerBody = body.toLowerCase();
    return POPULAR_TAGS.filter((tag) => {
      // Check if #tag is present in the body (case-insensitive word boundary)
      const regex = new RegExp(`#${tag.toLowerCase()}(?:[^a-z0-9_-]|$)`, 'i');
      return !regex.test(lowerBody);
    });
  }, [body]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animateTo = (toValue: number, duration: number) =>
      Animated.timing(keyboardSpace, {
        toValue,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      animateTo(e.endCoordinates.height, 220);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      animateTo(0, 180);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardSpace]);

  const handleSnapCamera = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_ATTACHMENTS} items per post.`);
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow camera permissions to photograph handwritten notes.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const asset = result.assets[0];
        const newAttachment: CommunityAttachment = {
          id: `cam-${Date.now()}`,
          type: 'image',
          url: asset.uri,
          name: `Photo_${Date.now()}.jpg`,
        };
        setAttachments((prev) => [...prev, newAttachment]);
        // Immediately offer to crop/straighten the fresh scan!
        setEditingImage(newAttachment);
      }
    } catch {
      Alert.alert('Error', 'Unable to open camera.');
    }
  };

  const handlePickImages = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_ATTACHMENTS} items per post.`);
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const remainingSlots = MAX_ATTACHMENTS - attachments.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newAttachments: CommunityAttachment[] = result.assets
          .slice(0, remainingSlots)
          .map((asset, i) => ({
            id: `img-${Date.now()}-${i}`,
            type: 'image',
            url: asset.uri,
            name: asset.fileName || `Photo_${i + 1}.jpg`,
          }));
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    } catch {
      Alert.alert('Permission needed', 'Please allow gallery permissions to attach images.');
    }
  };

  const handlePickDocument = async () => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_ATTACHMENTS} items per post.`);
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const doc = result.assets[0];
        const newPdf: CommunityAttachment = {
          id: `pdf-${Date.now()}`,
          type: 'pdf',
          url: doc.uri,
          name: doc.name,
          size: doc.size ? `${(doc.size / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB',
          pageCount: 6,
        };
        setAttachments((prev) => [...prev, newPdf]);
      }
    } catch {
      Alert.alert('Error', 'Unable to pick PDF document.');
    }
  };

  const handleAddMoreChoice = () => {
    Alert.alert('Add Attachment', 'Choose a source to attach to your post:', [
      { text: 'Take Photo', onPress: handleSnapCamera },
      { text: 'Choose from Gallery', onPress: handlePickImages },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeAttachment = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleImageEdited = (newUri: string) => {
    if (editingImage) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAttachments((prev) =>
        prev.map((item) =>
          item.id === editingImage.id ? { ...item, url: newUri } : item
        )
      );
    }
    setEditingImage(null);
  };

  const handleInsertHash = (tagText?: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (tagText) {
      setBody((prev) => {
        const cleaned = prev.trim();
        return cleaned ? `${cleaned} #${tagText} ` : `#${tagText} `;
      });
    } else {
      setBody((prev) => (prev && !/\s$/.test(prev) ? `${prev} #` : `${prev}#`));
    }
    inputRef.current?.focus();
  };

  const handleClose = () => {
    if (body.trim().length > 0 || attachments.length > 0) {
      Alert.alert(
        'Discard draft?',
        'If you leave now, your post and attachments will not be saved.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setBody('');
              setAttachments([]);
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const handleOpenOwnProfile = () => {
    Haptics.selectionAsync().catch(() => {});
    if (body.trim().length > 0 || attachments.length > 0) {
      Alert.alert(
        'Leave post composer?',
        'Do you want to leave this draft to view your profile?',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'View profile',
            onPress: () => {
              onClose();
              navigation.navigate('UserProfile', { userId: 'me' });
            },
          },
        ]
      );
    } else {
      onClose();
      navigation.navigate('UserProfile', { userId: 'me' });
    }
  };

  const handleSubmit = () => {
    if (!body.trim() && attachments.length === 0) {
      Alert.alert('Empty Post', 'Please write a message or attach notes to share with the community.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Extract hashtags from body
    const matches = body.match(/#[A-Za-z0-9_-]+/g) || [];
    const hashtags = Array.from(new Set(matches.map((m) => m.replace(/^#/, ''))));

    const postPayload = {
      author: {
        id: user?.id || 'me',
        name: authorName,
        avatarUrl: authorAvatarUrl,
        bio: 'Student • PYQDeck Community',
      },
      body: body.trim(),
      hashtags,
      attachments,
      status: 'published' as const,
    };

    // Kick off background publishing with optimistic progress bar in the feed
    startPostUpload(postPayload, (created) => {
      onPostCreated?.(created.id);
    });

    // Instantly close modal and reset composer state (LinkedIn / X instant dismiss)
    setBody('');
    setAttachments([]);
    onClose();
  };

  const isPostDisabled = !body.trim() && attachments.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top || 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close post composer"
          >
            <Feather name="x" size={22} color="#111827" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAuthorRow}
            activeOpacity={0.7}
            onPress={handleOpenOwnProfile}
            accessibilityRole="button"
            accessibilityLabel="View your profile"
          >
            {authorAvatarUrl ? (
              <Image source={{ uri: authorAvatarUrl }} style={styles.authorAvatarImg} contentFit="cover" />
            ) : (
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>{authorInitial}</Text>
              </View>
            )}
            <View style={styles.authorMeta}>
              <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
              <View style={styles.audiencePill}>
                <Feather name="globe" size={10} color="#6b7280" style={{ marginRight: 3.5 }} />
                <Text style={styles.audiencePillText}>Anyone</Text>
                <Feather name="chevron-down" size={10} color="#9ca3af" style={{ marginLeft: 3 }} />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isPostDisabled}
            style={[styles.postBtn, isPostDisabled && styles.postBtnDisabled]}
            accessibilityLabel="Publish post"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.postBtnText, isPostDisabled && styles.postBtnTextDisabled]}>
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Scrollable Writing Canvas: Full flex, tap anywhere to focus */}
        <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()} accessible={false}>
          <View style={styles.canvasContainer}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                multiline
                placeholder="Ask a doubt, share handwritten notes, or discuss exam questions..."
                placeholderTextColor="#9ca3af"
                value={body}
                onChangeText={setBody}
                textAlignVertical="top"
                autoFocus
              />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>

        {/* Footer Container: Grouped Attachments Strip + Quick Hashtags + Bottom Toolbar */}
        <View style={styles.footerContainer}>
          {/* Quick Hashtags Strip: Only shown when there are unused suggested tags */}
          {availableTags.length > 0 && (
            <View style={styles.quickTagsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickTagsRow}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.quickTagsLabel}>Suggested:</Text>
                {availableTags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      handleInsertHash(tag);
                    }}
                    style={styles.quickTagChip}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickTagChipText}>
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Docked Attachments Strip: Sits directly above bottom buttons, moves together */}
          {attachments.length > 0 && (
            <View style={styles.dockedAttachmentsSection}>
              <View style={styles.dockedAttachmentsHeader}>
                <Text style={styles.dockedAttachmentsTitle}>
                  Attached Media ({attachments.length}/{MAX_ATTACHMENTS})
                </Text>
                <Text style={styles.dockedAttachmentsHint}>
                  Tap any photo to crop or rotate
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.attachmentsRow}
                keyboardShouldPersistTaps="handled"
              >
                {attachments.map((att) => (
                  <View key={att.id} style={styles.attachmentThumbCard}>
                    {att.type === 'image' ? (
                      <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => setEditingImage(att)}
                        style={styles.thumbImageWrap}
                        accessibilityLabel={`Crop or edit ${att.name}`}
                      >
                        <Image source={{ uri: att.url }} style={styles.thumbImage} contentFit="cover" />
                        <View style={styles.editPill}>
                          <Feather name="crop" size={10} color="#ffffff" style={{ marginRight: 3 }} />
                          <Text style={styles.editPillText}>Edit</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.thumbPdf}>
                        <View style={styles.pdfBadgeIcon}>
                          <Feather name="file-text" size={22} color={COLORS.primary} />
                        </View>
                        <Text style={styles.thumbPdfName} numberOfLines={1}>
                          {att.name}
                        </Text>
                        <Text style={styles.thumbPdfMeta}>
                          {att.size || 'PDF Document'}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeThumbBtn}
                      onPress={() => removeAttachment(att.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Remove attachment"
                    >
                      <Feather name="x" size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* "+ Add" Card when under limit */}
                {attachments.length < MAX_ATTACHMENTS && (
                  <TouchableOpacity
                    style={styles.addMoreCard}
                    onPress={handleAddMoreChoice}
                    activeOpacity={0.7}
                    accessibilityLabel="Add more attachments"
                  >
                    <View style={styles.addMoreIconWrap}>
                      <Feather name="plus" size={18} color="#6b7280" />
                    </View>
                    <Text style={styles.addMoreText}>Add</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* Bottom Action Toolbar */}
          <View
            style={[
              styles.bottomToolBar,
                        { paddingBottom: isKeyboardVisible ? (Platform.OS === 'android' ? 24 : 12) : Math.max(insets.bottom, 12) },

            ]}
          >
            <View style={styles.toolsGroup}>
              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={handleSnapCamera}
                accessibilityLabel="Take photo with camera"
                activeOpacity={0.7}
              >
                <Feather name="camera" size={20} color="#374151" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={handlePickImages}
                accessibilityLabel="Add photo from gallery"
                activeOpacity={0.7}
              >
                <Feather name="image" size={20} color="#374151" />
              </TouchableOpacity>

              {ALLOW_PDF ? (
                <TouchableOpacity
                  style={styles.toolIconBtn}
                  onPress={handlePickDocument}
                  accessibilityLabel="Attach PDF notes"
                  activeOpacity={0.7}
                >
                  <Feather name="file-text" size={20} color="#374151" />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={() => handleInsertHash()}
                accessibilityLabel="Add tag"
                activeOpacity={0.7}
              >
                <Feather name="hash" size={20} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Live Character/Word Hint */}
            <View style={styles.counterWrap}>
              <Text style={styles.counterText}>
                {body.length > 0 ? `${body.length} chars` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Android is edge-to-edge: lifts footer cleanly by real IME height */}
        {Platform.OS === 'android' && <Animated.View style={{ height: keyboardSpace }} />}

        {/* Full-screen Image Crop & Straighten Editor */}
        <ImageCropEditor
          uri={editingImage?.url ?? null}
          title="Edit & Crop Photo"
          onCancel={() => setEditingImage(null)}
          onDone={handleImageEdited}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeBtn: {
    padding: 4,
  },
  headerAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondaryLight,
    borderWidth: 1,
    borderColor: 'rgba(31, 75, 67, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  authorAvatarText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: COLORS.secondary,
  },
  authorMeta: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#111827',
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: RADIUS.full,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  audiencePillText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10.5,
    color: '#4b5563',
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
  },
  postBtnDisabled: {
    backgroundColor: '#f3f4f6',
  },
  postBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  postBtnTextDisabled: {
    color: '#9ca3af',
  },
  canvasContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    flexGrow: 1,
  },
  textInput: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
    minHeight: 120,
  },

  footerContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  quickTagsContainer: {
    paddingVertical: 7,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  quickTagsRow: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  quickTagsLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodyMedium,
    color: '#9ca3af',
    marginRight: 2,
  },
  quickTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3f4f6',
  },
  quickTagChipActive: {
    backgroundColor: COLORS.primaryLight,
  },
  quickTagChipText: {
    fontSize: 11,
    fontFamily: FONTS.bodyMedium,
    color: '#4b5563',
  },
  quickTagChipTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.displayBold,
  },

  dockedAttachmentsSection: {
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#fafaf9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dockedAttachmentsHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dockedAttachmentsTitle: {
    fontSize: 11,
    fontFamily: FONTS.displayBold,
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dockedAttachmentsHint: {
    fontSize: 10.5,
    fontFamily: FONTS.body,
    color: '#9ca3af',
  },
  attachmentsRow: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachmentThumbCard: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbImageWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  editPill: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    alignItems: 'center',
  },
  editPillText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontFamily: FONTS.displayBold,
  },
  thumbPdf: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#fafafa',
  },
  pdfBadgeIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  thumbPdfName: {
    fontSize: 9.5,
    fontFamily: FONTS.displayBold,
    color: '#374151',
    textAlign: 'center',
  },
  thumbPdfMeta: {
    fontSize: 8.5,
    fontFamily: FONTS.body,
    color: '#9ca3af',
    marginTop: 2,
  },
  removeThumbBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.68)',
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addMoreCard: {
    width: 72,
    height: 100,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addMoreIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    fontSize: 10,
    fontFamily: FONTS.displayBold,
    color: '#6b7280',
  },

  bottomToolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#ffffff',
  },
  toolsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toolIconBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterWrap: {
    paddingRight: 4,
  },
  counterText: {
    fontSize: 11,
    fontFamily: FONTS.body,
    color: '#9ca3af',
  },
});
