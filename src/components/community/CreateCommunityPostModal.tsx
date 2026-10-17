import React, { useEffect, useRef, useState } from 'react';
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
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/expo';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { CommunityAttachment } from '../../types/community';
import { communityStore } from '../../data/mockCommunity';
import { ImageCropEditor } from '../ImageCropEditor';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const { user } = useUser();
  const inputRef = useRef<TextInput>(null);

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<CommunityAttachment[]>([]);
  const [editingImage, setEditingImage] = useState<CommunityAttachment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardSpace = useRef(new Animated.Value(0)).current;

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

  // Resolve author details from Clerk user or fallback to student profile
  const authorName =
    user?.fullName ||
    (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'You (Student)');
  const authorAvatarUrl = user?.imageUrl;
  const authorInitial = (user?.firstName?.[0] || authorName[0] || 'Y').toUpperCase();

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

  const handlePickImages = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newAttachments: CommunityAttachment[] = result.assets.map((asset, i) => ({
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

  const removeAttachment = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleInsertHash = () => {
    Haptics.selectionAsync().catch(() => {});
    setBody((prev) => (prev && !/\s$/.test(prev) ? `${prev} #` : `${prev}#`));
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

  const handleSubmit = () => {
    if (!body.trim() && attachments.length === 0) {
      Alert.alert('Empty Post', 'Please write a message or attach notes to share with the community.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSubmitting(true);

    // Extract hashtags from body
    const matches = body.match(/#[A-Za-z0-9_-]+/g) || [];
    const hashtags = Array.from(new Set(matches.map((m) => m.replace(/^#/, ''))));

    setTimeout(() => {
      const created = communityStore.addPost({
        author: {
          id: user?.id || 'me',
          name: authorName,
          avatarUrl: authorAvatarUrl,
          bio: 'Student • PYQDeck Community',
        },
        body: body.trim(),
        hashtags,
        attachments,
        status: 'published',
      });

      setSubmitting(false);
      setBody('');
      setAttachments([]);
      onClose();
      onPostCreated?.(created.id);
    }, 400);
  };

  const isPostDisabled = submitting || (!body.trim() && attachments.length === 0);

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

          <View style={styles.headerAuthorRow}>
            {authorAvatarUrl ? (
              <Image source={{ uri: authorAvatarUrl }} style={styles.authorAvatarImg} contentFit="cover" />
            ) : (
              <View style={styles.authorAvatar}>
                <Text style={styles.authorAvatarText}>{authorInitial}</Text>
              </View>
            )}
            <View>
              <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
              <View style={styles.audiencePill}>
                <Feather name="globe" size={10} color="#6b7280" style={{ marginRight: 3 }} />
                <Text style={styles.audiencePillText}>Anyone</Text>
              </View>
            </View>
          </View>

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
                placeholder="What do you want to share with the community?"
                placeholderTextColor="#9ca3af"
                value={body}
                onChangeText={setBody}
                textAlignVertical="top"
                autoFocus
              />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>

        {/* Footer Container: Grouped Attachments Strip + Bottom Toolbar */}
        <View style={styles.footerContainer}>
          {/* Docked Attachments Strip: Sits directly above bottom buttons, moves together */}
          {attachments.length > 0 && (
            <View style={styles.dockedAttachmentsSection}>
              <View style={styles.dockedAttachmentsHeader}>
                <Text style={styles.dockedAttachmentsTitle}>
                  Attachments ({attachments.length})
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
                        activeOpacity={0.85}
                        onPress={() => setEditingImage(att)}
                        style={styles.thumbImageWrap}
                        accessibilityLabel={`Crop or edit ${att.name}`}
                      >
                        <Image source={{ uri: att.url }} style={styles.thumbImage} contentFit="cover" />
                        <View style={styles.cropBadge}>
                          <Feather name="crop" size={11} color="#ffffff" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.thumbPdf}>
                        <Feather name="file-text" size={24} color={COLORS.primary} />
                        <Text style={styles.thumbPdfName} numberOfLines={1}>
                          {att.name}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeThumbBtn}
                      onPress={() => removeAttachment(att.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Remove attachment"
                    >
                      <Feather name="x" size={13} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}
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
            <TouchableOpacity
              style={styles.toolIconBtn}
              onPress={handlePickImages}
              accessibilityLabel="Add photo"
            >
              <Feather name="image" size={21} color="#4b5563" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolIconBtn}
              onPress={handlePickDocument}
              accessibilityLabel="Add PDF"
            >
              <Feather name="file-text" size={21} color="#4b5563" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolIconBtn}
              onPress={handleInsertHash}
              accessibilityLabel="Add tag"
            >
              <Feather name="hash" size={21} color="#4b5563" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Android is edge-to-edge: lifts footer cleanly by real IME height */}
        {Platform.OS === 'android' && <Animated.View style={{ height: keyboardSpace }} />}

        {/* Full-screen Image Crop & Correction Editor */}
        <ImageCropEditor
          uri={editingImage?.url ?? null}
          title="Edit Photo"
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
  authorName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#111827',
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
    marginTop: 1,
    alignSelf: 'flex-start',
  },
  audiencePillText: {
    fontFamily: FONTS.body,
    fontSize: 10,
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
  dockedAttachmentsSection: {
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#fafaf9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dockedAttachmentsHeader: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  dockedAttachmentsTitle: {
    fontSize: 11,
    fontFamily: FONTS.bodyMedium,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  attachmentsRow: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
  },
  attachmentThumbCard: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbImageWrap: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cropBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPdf: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  thumbPdfName: {
    fontSize: 9,
    fontFamily: FONTS.bodyMedium,
    color: '#374151',
    marginTop: 4,
    textAlign: 'center',
  },
  removeThumbBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomToolBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 22,
    backgroundColor: '#ffffff',
  },
  toolIconBtn: {
    padding: 8,
    borderRadius: RADIUS.full,
  },
});
