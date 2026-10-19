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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, COVER_ASPECT, COVER_ASPECT_RATIO, FONTS, RADIUS } from '../../theme/colors';
import { UserProfileData } from '../../services/userProfileService';
import { CollegePickerBottomSheet } from './CollegePickerBottomSheet';
import { BranchPickerBottomSheet } from './BranchPickerBottomSheet';

const SEMESTERS = [
  '1st Sem',
  '2nd Sem',
  '3rd Sem',
  '4th Sem',
  '5th Sem',
  '6th Sem',
  '7th Sem',
  '8th Sem',
];

const QUICK_PASSOUT_YEARS = [
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2019',
  '2018',
];

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
  const [isCollegePickerVisible, setIsCollegePickerVisible] = useState(false);
  const [branch, setBranch] = useState(profile.branch || '');
  const [isBranchPickerVisible, setIsBranchPickerVisible] = useState(false);
  const [semester, setSemester] = useState(profile.semester || '');
  const [gradYear, setGradYear] = useState(profile.gradYear || '');
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
  const gradYearRef = useRef<TextInput>(null);
  const locationRef = useRef<TextInput>(null);
  const aboutRef = useRef<TextInput>(null);
  const githubRef = useRef<TextInput>(null);
  const linkedinRef = useRef<TextInput>(null);
  const websiteRef = useRef<TextInput>(null);
  const twitterRef = useRef<TextInput>(null);

  // Determine if user has passed out / alumni status
  const isAlumni = useMemo(() => {
    const s = (semester || '').toLowerCase();
    return (
      s.includes('alumn') ||
      s.includes('graduat') ||
      s.includes('passout') ||
      s.includes('passed')
    );
  }, [semester]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible && profile) {
      setName(profile.name || '');
      setBio(profile.bio || '');
      setCollege(profile.college || '');
      setBranch(profile.branch || '');
      setSemester(profile.semester || '');
      setGradYear(profile.gradYear || '');
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

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollYRef = useRef(0);
  const keyboardTopRef = useRef(0); // screen Y where keyboard starts (0 = hidden)
  const focusedInputRef = useRef<TextInput | null>(null);

  // Robust cross-platform keyboard height listener
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
      keyboardTopRef.current =
        e.endCoordinates.screenY || Dimensions.get('window').height - e.endCoordinates.height;
      // Wait for bottom padding to render, then bring focused input into view
      setTimeout(() => ensureFocusedVisible(), 120);
      Animated.timing(keyboardSpace, {
        toValue: e.endCoordinates.height,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      keyboardTopRef.current = 0;
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

  // Measure the focused input on screen and scroll just enough to sit above the keyboard
  const ensureFocusedVisible = () => {
    const input = focusedInputRef.current;
    const kbTop = keyboardTopRef.current;
    if (!input || !kbTop) return;
    input.measureInWindow((_x, y, _w, h) => {
      const bottomLimit = kbTop - 56; // keep clear of keyboard + Done bar
      const topLimit = (insets.top || 12) + 80; // keep clear of header
      let delta = 0;
      if (y + h > bottomLimit) delta = y + h - bottomLimit;
      else if (y < topLimit) delta = y - topLimit;
      if (delta !== 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, scrollYRef.current + delta), animated: true });
      }
    });
  };

  const onFieldFocus = (ref: React.RefObject<TextInput | null>) => () => {
    focusedInputRef.current = ref.current;
    // If keyboard is already up (moving between fields) scroll now;
    // otherwise the keyboard show listener handles it.
    if (keyboardTopRef.current) setTimeout(() => ensureFocusedVisible(), 60);
  };

  // Check if user has modified anything
  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      name !== (profile.name || '') ||
      bio !== (profile.bio || '') ||
      college !== (profile.college || '') ||
      branch !== (profile.branch || '') ||
      semester !== (profile.semester || '') ||
      gradYear !== (profile.gradYear || '') ||
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
    gradYear,
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
              aspect: COVER_ASPECT,
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
        semester: semester.trim() || (isAlumni ? 'Alumni' : 'B.Tech'),
        gradYear: gradYear.trim() || undefined,
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 30 : 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
                onFocus={onFieldFocus(nameRef)}
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
                onFocus={onFieldFocus(bioRef)}
                style={styles.textInput}
                value={bio}
                onChangeText={setBio}
                placeholder="e.g. CSE 3rd Year • Core CS & Systems • GATE '26"
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
                onSubmitEditing={() => setIsCollegePickerVisible(true)}
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

            {/* Academic Status Segment (Current Student vs Passed Out / Alumni) */}
            <View style={styles.statusSegment}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  if (isAlumni) {
                    setSemester('6th Sem');
                  }
                }}
                style={[styles.statusSegmentBtn, !isAlumni && styles.statusSegmentBtnActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="school"
                  size={14}
                  color={!isAlumni ? COLORS.primary : '#64748b'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.statusSegmentText, !isAlumni && styles.statusSegmentTextActive]}>
                  Current Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSemester('Alumni');
                  if (!gradYear) {
                    setGradYear('2024');
                  }
                }}
                style={[styles.statusSegmentBtn, isAlumni && styles.statusSegmentBtnActive]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="ribbon"
                  size={14}
                  color={isAlumni ? COLORS.primary : '#64748b'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.statusSegmentText, isAlumni && styles.statusSegmentTextActive]}>
                  Passed Out / Alumni
                </Text>
              </TouchableOpacity>
            </View>

            {/* Engineering College Picker Trigger */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Engineering College</Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsCollegePickerVisible(true);
                  }}
                  style={styles.browseCollegesBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="school-outline" size={12} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={styles.browseCollegesBtnText}>Browse 56+ BEU Colleges</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsCollegePickerVisible(true);
                }}
                style={[
                  styles.collegePickerTrigger,
                  college ? styles.collegePickerTriggerActive : undefined,
                ]}
                accessibilityLabel="Select engineering college"
              >
                <View style={styles.collegePickerLeft}>
                  <View
                    style={[
                      styles.collegePickerIconWrap,
                      college ? styles.collegePickerIconWrapActive : undefined,
                    ]}
                  >
                    <Ionicons
                      name="school"
                      size={16}
                      color={college ? COLORS.primary : '#94a3b8'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.collegePickerValue,
                      college ? styles.collegePickerValueFilled : styles.collegePickerPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {college || 'Select your engineering college...'}
                  </Text>
                </View>

                <View style={styles.collegePickerRight}>
                  {college ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setCollege('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.collegeClearBtn}
                      accessibilityLabel="Clear selected college"
                    >
                      <Feather name="x" size={14} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                  <Feather name="chevron-down" size={17} color="#64748b" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Engineering Branch Picker Trigger */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>Branch / Discipline</Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setIsBranchPickerVisible(true);
                  }}
                  style={styles.browseCollegesBtn}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialCommunityIcons
                    name="compass-outline"
                    size={12}
                    color={COLORS.primary}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.browseCollegesBtnText}>Browse 34+ BEU Branches</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Keyboard.dismiss();
                  setIsBranchPickerVisible(true);
                }}
                style={[
                  styles.collegePickerTrigger,
                  branch ? styles.collegePickerTriggerActive : undefined,
                ]}
                accessibilityLabel="Select engineering branch"
              >
                <View style={styles.collegePickerLeft}>
                  <View
                    style={[
                      styles.collegePickerIconWrap,
                      branch ? styles.collegePickerIconWrapActive : undefined,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="compass"
                      size={16}
                      color={branch ? COLORS.primary : '#94a3b8'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.collegePickerValue,
                      branch ? styles.collegePickerValueFilled : styles.collegePickerPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {branch || 'Select your engineering branch...'}
                  </Text>
                </View>

                <View style={styles.collegePickerRight}>
                  {branch ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setBranch('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.collegeClearBtn}
                      accessibilityLabel="Clear selected branch"
                    >
                      <Feather name="x" size={14} color="#64748b" />
                    </TouchableOpacity>
                  ) : null}
                  <Feather name="chevron-down" size={17} color="#64748b" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Semester (for Students) or Passout Batch (for Alumni) */}
            {isAlumni ? (
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Passout Batch (Graduation Year)</Text>
                  {gradYear ? (
                    <Text style={styles.activeSemBadgeText}>Batch of {gradYear}</Text>
                  ) : null}
                </View>
                <TextInput
                  ref={gradYearRef}
                  onFocus={onFieldFocus(gradYearRef)}
                  style={styles.textInput}
                  value={gradYear}
                  onChangeText={setGradYear}
                  placeholder="e.g. 2024"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => locationRef.current?.focus()}
                  blurOnSubmit={false}
                />
                {/* Passout Year Shortcuts for Alumni */}
                <View style={[styles.quickChipsSection, { marginTop: 4 }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickChipsScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {QUICK_PASSOUT_YEARS.map((y) => {
                      const active = gradYear === y;
                      return (
                        <TouchableOpacity
                          key={y}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setGradYear(y);
                          }}
                          style={[styles.quickChip, active && styles.quickChipActive]}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                            Batch {y}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>Current Semester</Text>
                  {semester ? (
                    <Text style={styles.activeSemBadgeText}>{semester}</Text>
                  ) : null}
                </View>

                {/* Unified 1st to 8th Semester Button Selector */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.semScrollContainer}
                  keyboardShouldPersistTaps="handled"
                >
                  {SEMESTERS.map((s) => {
                    const active = semester.toLowerCase() === s.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setSemester(s);
                        }}
                        style={[styles.semSelectBtn, active && styles.semSelectBtnActive]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.semSelectBtnText,
                            active && styles.semSelectBtnTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Location / City</Text>
              <TextInput
                ref={locationRef}
                onFocus={onFieldFocus(locationRef)}
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
                onFocus={onFieldFocus(aboutRef)}
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
                  onFocus={onFieldFocus(githubRef)}
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
                  onFocus={onFieldFocus(linkedinRef)}
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
                  onFocus={onFieldFocus(websiteRef)}
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
                  onFocus={onFieldFocus(twitterRef)}
                  placeholder="@handle or URL"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
            </View>
          </View>
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

      {/* Engineering College Picker Bottom Sheet */}
      <CollegePickerBottomSheet
        visible={isCollegePickerVisible}
        selectedCollege={college}
        onSelect={(selectedName, selectedLoc) => {
          setCollege(selectedName);
          if (
            selectedLoc &&
            (!location || location.trim() === 'Bihar, India' || location.trim() === 'Bihar')
          ) {
            setLocation(selectedLoc);
          }
        }}
        onClose={() => setIsCollegePickerVisible(false)}
      />

      {/* Engineering Branch Picker Bottom Sheet */}
      <BranchPickerBottomSheet
        visible={isBranchPickerVisible}
        selectedBranch={branch}
        onSelect={(branchName) => {
          setBranch(branchName);
        }}
        onClose={() => setIsBranchPickerVisible(false)}
      />
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
    aspectRatio: COVER_ASPECT_RATIO,
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
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  browseCollegesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  browseCollegesBtnText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11.5,
    color: COLORS.primary,
  },
  collegePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
    gap: 8,
  },
  collegePickerTriggerActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#fafbfc',
  },
  collegePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  collegePickerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collegePickerIconWrapActive: {
    backgroundColor: '#e0e7ff',
  },
  collegePickerValue: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13.5,
  },
  collegePickerValueFilled: {
    color: '#0f172a',
    fontFamily: FONTS.bodySemi,
  },
  collegePickerPlaceholder: {
    color: '#9ca3af',
  },
  collegePickerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  collegeClearBtn: {
    padding: 3,
  },
  quickChipsSection: {
    gap: 6,
  },
  quickChipsLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickChipsScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  quickChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickChipText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11.5,
    color: '#475569',
  },
  quickChipTextActive: {
    color: '#ffffff',
    fontFamily: FONTS.bodySemi,
  },
  statusSegment: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: 4,
    gap: 4,
  },
  statusSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
  },
  statusSegmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statusSegmentText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    color: '#64748b',
  },
  statusSegmentTextActive: {
    fontFamily: FONTS.displayBold,
    color: COLORS.primary,
  },
  activeSemBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.primary,
  },
  semScrollContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  semSelectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  semSelectBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  semSelectBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12.5,
    color: '#475569',
  },
  semSelectBtnTextActive: {
    color: '#ffffff',
    fontFamily: FONTS.bodySemi,
  },
});
