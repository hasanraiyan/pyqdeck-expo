import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Easing,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';
import { UserProfileData } from '../../services/userProfileService';

interface EditProfileModalProps {
  visible: boolean;
  profile: UserProfileData;
  onClose: () => void;
  onSave: (updated: Partial<UserProfileData>) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  profile,
  onClose,
  onSave,
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardSpace = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Form Fields State
  const [name, setName] = useState(profile.name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [college, setCollege] = useState(profile.college || '');
  const [branch, setBranch] = useState(profile.branch || '');
  const [semester, setSemester] = useState(profile.semester || '');
  const [location, setLocation] = useState(profile.location || '');
  const [about, setAbout] = useState(profile.about || '');
  const [github, setGithub] = useState(profile.github || '');
  const [linkedin, setLinkedin] = useState(profile.linkedin || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [twitter, setTwitter] = useState(profile.twitter || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl || '');
  const [saving, setSaving] = useState(false);

  // TextInput References for smooth next-key chaining
  const nameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);
  const collegeRef = useRef<TextInput>(null);
  const branchRef = useRef<TextInput>(null);
  const semesterRef = useRef<TextInput>(null);
  const locationRef = useRef<TextInput>(null);
  const aboutRef = useRef<TextInput>(null);
  const githubRef = useRef<TextInput>(null);
  const linkedinRef = useRef<TextInput>(null);
  const websiteRef = useRef<TextInput>(null);
  const twitterRef = useRef<TextInput>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (visible && profile) {
      setName(profile.name || '');
      setBio(profile.bio || '');
      setCollege(profile.college || '');
      setBranch(profile.branch || '');
      setSemester(profile.semester || '');
      setLocation(profile.location || '');
      setAbout(profile.about || '');
      setGithub(profile.github || '');
      setLinkedin(profile.linkedin || '');
      setWebsite(profile.website || '');
      setTwitter(profile.twitter || '');
      setAvatarUrl(profile.avatarUrl || '');
      setCoverUrl(profile.coverUrl || '');
    }
  }, [visible, profile]);

  // Robust cross-platform keyboard height listener
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      Animated.timing(keyboardSpace, {
        toValue: e.endCoordinates.height,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      Animated.timing(keyboardSpace, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardSpace]);

  // Check if user has modified anything
  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name || '') ||
      bio !== (profile.bio || '') ||
      college !== (profile.college || '') ||
      branch !== (profile.branch || '') ||
      semester !== (profile.semester || '') ||
      location !== (profile.location || '') ||
      about !== (profile.about || '') ||
      github !== (profile.github || '') ||
      linkedin !== (profile.linkedin || '') ||
      website !== (profile.website || '') ||
      twitter !== (profile.twitter || '') ||
      avatarUrl !== (profile.avatarUrl || '') ||
      coverUrl !== (profile.coverUrl || '')
    );
  }, [
    profile,
    name,
    bio,
    college,
    branch,
    semester,
    location,
    about,
    github,
    linkedin,
    website,
    twitter,
    avatarUrl,
    coverUrl,
  ]);

  const handleClose = () => {
    Keyboard.dismiss();
    if (isDirty) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved edits. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              Haptics.selectionAsync().catch(() => {});
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  };

  const handlePickAvatar = () => {
    Alert.alert('Profile Photo', 'Update your community avatar:', [
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Needed', 'Camera permission is required to take a photo.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
              setAvatarUrl(res.assets[0].uri);
            }
          } catch {
            Alert.alert('Error', 'Unable to access camera.');
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
              setAvatarUrl(res.assets[0].uri);
            }
          } catch {
            Alert.alert('Error', 'Unable to pick photo.');
          }
        },
      },
      avatarUrl
        ? {
            text: 'Remove Photo',
            style: 'destructive',
            onPress: () => setAvatarUrl(''),
          }
        : null,
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean) as any);
  };

  const handlePickCover = () => {
    Alert.alert('Cover Banner', 'Choose an option for your cover banner:', [
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.85,
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
              setCoverUrl(res.assets[0].uri);
            }
          } catch {
            Alert.alert('Error', 'Unable to pick cover.');
          }
        },
      },
      {
        text: 'Reset to Engineering Default',
        onPress: () => {
          setCoverUrl(
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80'
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name.');
      nameRef.current?.focus();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSaving(true);

    try {
      await onSave({
        name: name.trim(),
        bio: bio.trim() || 'Student • PYQDeck Community',
        college: college.trim() || 'Bihar Engineering University',
        branch: branch.trim() || 'Engineering',
        semester: semester.trim() || 'B.Tech',
        location: location.trim() || 'Bihar, India',
        about: about.trim(),
        github: github.trim(),
        linkedin: linkedin.trim(),
        website: website.trim(),
        twitter: twitter.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
      });
      onClose();
    } catch {
      Alert.alert('Save Failed', 'Could not save profile updates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (n[0] || 'U').toUpperCase();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top || 12 }]}
      >
        {/* Modal Top Header Bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
            accessibilityLabel="Close editor"
          >
            <Feather name="x" size={22} color="#1f2937" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Edit Profile</Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !name.trim()}
            style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
            accessibilityLabel="Save profile changes"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Scrollable Form Area with dynamic keyboard spacer */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Cover Banner & Avatar Hero Card */}
          <View style={styles.heroSection}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handlePickCover}
              style={styles.coverWrapper}
            >
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
              ) : (
                <View style={styles.coverFallback} />
              )}
              <View style={styles.coverEditPill}>
                <Feather name="camera" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.coverEditText}>Edit Cover</Text>
              </View>
            </TouchableOpacity>

            {/* Avatar with Camera Badge */}
            <View style={styles.avatarRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickAvatar}
                style={styles.avatarWrapper}
                accessibilityLabel="Change profile avatar"
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <View style={styles.avatarMonogram}>
                    <Text style={styles.avatarMonogramText}>{getInitials(name)}</Text>
                  </View>
                )}
                <View style={styles.avatarCameraBadge}>
                  <Feather name="camera" size={14} color="#ffffff" />
                </View>
              </TouchableOpacity>

              <View style={styles.avatarHintContainer}>
                <Text style={styles.avatarHintTitle}>Profile Photo</Text>
                <Text style={styles.avatarHintSub}>Tap to change or remove photo</Text>
              </View>
            </View>
          </View>

          {/* Section 1: Basic Information */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Feather name="user" size={16} color={COLORS.primary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Basic Information</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Full Name <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                ref={nameRef}
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rahul Kumar"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                onSubmitEditing={() => bioRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Headline / Bio <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                ref={bioRef}
                style={styles.textInput}
                value={bio}
                onChangeText={setBio}
                placeholder="e.g. CSE 3rd Year • Core CS & Systems • GATE '26"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                onSubmitEditing={() => collegeRef.current?.focus()}
                blurOnSubmit={false}
              />
              <Text style={styles.helperText}>
                Appears under your name in community posts, solutions, and comments.
              </Text>
            </View>
          </View>

          {/* Section 2: Academic Details */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="school-outline" size={17} color={COLORS.primary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Academic Details</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Engineering College</Text>
              <TextInput
                ref={collegeRef}
                style={styles.textInput}
                value={college}
                onChangeText={setCollege}
                placeholder="e.g. BCE Bhagalpur / MIT Muzaffarpur / GEC Patna"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                onSubmitEditing={() => branchRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.twoColumnRow}>
              <View style={[styles.inputGroup, { flex: 1.2 }]}>
                <Text style={styles.inputLabel}>Branch / Stream</Text>
                <TextInput
                  ref={branchRef}
                  style={styles.textInput}
                  value={branch}
                  onChangeText={setBranch}
                  placeholder="e.g. CSE / ECE / ME / Civil"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                  onSubmitEditing={() => semesterRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Semester</Text>
                <TextInput
                  ref={semesterRef}
                  style={styles.textInput}
                  value={semester}
                  onChangeText={setSemester}
                  placeholder="e.g. 6th Semester"
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                  onSubmitEditing={() => locationRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location / City</Text>
              <TextInput
                ref={locationRef}
                style={styles.textInput}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Patna, Bihar"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                onSubmitEditing={() => aboutRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>

          {/* Section 3: About You */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={16} color={COLORS.primary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>About You</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Bio / Introduction</Text>
              <TextInput
                ref={aboutRef}
                style={[styles.textInput, styles.textAreaInput]}
                value={about}
                onChangeText={setAbout}
                multiline
                numberOfLines={4}
                placeholder="Share your exam prep focus, favorite subjects, or engineering aspirations with peers..."
                placeholderTextColor="#9ca3af"
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Section 4: Social & Professional Links */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Feather name="globe" size={16} color={COLORS.primary} style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Social & Web Presence</Text>
            </View>

            {/* GitHub */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GitHub Profile</Text>
              <View style={styles.iconInputRow}>
                <View style={styles.inputPrefixIcon}>
                  <Feather name="github" size={16} color="#4b5563" />
                </View>
                <TextInput
                  ref={githubRef}
                  style={[styles.textInput, styles.prefixedInput]}
                  value={github}
                  onChangeText={setGithub}
                  placeholder="username or URL"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => linkedinRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* LinkedIn */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>LinkedIn Profile</Text>
              <View style={styles.iconInputRow}>
                <View style={styles.inputPrefixIcon}>
                  <Feather name="linkedin" size={16} color="#0077b5" />
                </View>
                <TextInput
                  ref={linkedinRef}
                  style={[styles.textInput, styles.prefixedInput]}
                  value={linkedin}
                  onChangeText={setLinkedin}
                  placeholder="username or URL"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => websiteRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Personal Website */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Personal Portfolio / Website</Text>
              <View style={styles.iconInputRow}>
                <View style={styles.inputPrefixIcon}>
                  <Feather name="link" size={16} color="#059669" />
                </View>
                <TextInput
                  ref={websiteRef}
                  style={[styles.textInput, styles.prefixedInput]}
                  value={website}
                  onChangeText={setWebsite}
                  placeholder="https://yourportfolio.dev"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                  onSubmitEditing={() => twitterRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            </View>

            {/* Twitter / X */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>X (Twitter) Profile</Text>
              <View style={styles.iconInputRow}>
                <View style={styles.inputPrefixIcon}>
                  <Feather name="twitter" size={16} color="#0284c7" />
                </View>
                <TextInput
                  ref={twitterRef}
                  style={[styles.textInput, styles.prefixedInput]}
                  value={twitter}
                  onChangeText={setTwitter}
                  placeholder="@handle or URL"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>
          </View>

          {/* Android Keyboard Dynamic Spacer (Prevents keyboard covering bottom fields) */}
          <Animated.View style={{ height: keyboardSpace }} />
        </ScrollView>

        {/* Floating Keyboard Dismiss Bar when keyboard is visible */}
        {isKeyboardVisible && (
          <View style={styles.keyboardDismissBar}>
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={styles.keyboardDoneBtn}
              activeOpacity={0.7}
            >
              <Feather name="chevron-down" size={16} color="#374151" style={{ marginRight: 4 }} />
              <Text style={styles.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    zIndex: 10,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16.5,
    color: '#0f172a',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  saveBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  heroSection: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  coverWrapper: {
    height: 110,
    width: '100%',
    backgroundColor: '#cbd5e1',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
  },
  coverEditPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: RADIUS.full,
  },
  coverEditText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: '#ffffff',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    marginTop: -36,
  },
  avatarWrapper: {
    position: 'relative',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  avatarMonogram: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: COLORS.secondaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMonogramText: {
    fontFamily: FONTS.displayBold,
    fontSize: 24,
    color: COLORS.secondary,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHintContainer: {
    marginLeft: 14,
    marginTop: 34,
    flex: 1,
  },
  avatarHintTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#1e293b',
  },
  avatarHintSub: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 13,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  inputGroup: {
    gap: 5,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12.5,
    color: '#334155',
  },
  requiredAsterisk: {
    color: '#dc2626',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  textAreaInput: {
    minHeight: 90,
    paddingTop: 10,
  },
  helperText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  iconInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  inputPrefixIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixedInput: {
    flex: 1,
    paddingLeft: 38,
  },
  keyboardDismissBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  keyboardDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  keyboardDoneText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#334155',
  },
});
