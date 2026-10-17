import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useUser } from '@clerk/expo';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ScreenContainer } from '../components/ScreenContainer';
import { CommunityPostCard } from '../components/community/CommunityPostCard';
import { communityStore } from '../data/mockCommunity';
import { CommunityAuthor, CommunityPost } from '../types/community';
import {
  userProfileService,
  UserProfileData,
} from '../services/userProfileService';

export const UserProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user: clerkUser } = useUser();

  const { userId = 'me', author: authorHint } = (route.params || {}) as {
    userId?: string;
    author?: CommunityAuthor;
  };

  const isOwnProfile =
    userId === 'me' || (clerkUser?.id && userId === clerkUser.id);

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'contributions' | 'saved'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // Edit profile modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCollege, setEditCollege] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editSemester, setEditSemester] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editGithub, setEditGithub] = useState('');
  const [editLinkedin, setEditLinkedin] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Community store posts subscription
  const [allPosts, setAllPosts] = useState<CommunityPost[]>(() => communityStore.getPosts());

  useEffect(() => {
    const unsub = communityStore.subscribe(() => {
      setAllPosts([...communityStore.getPosts()]);
    });
    return unsub;
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await userProfileService.getProfile(userId, authorHint, clerkUser);
      setProfile(data);
      setIsFollowing(!!data.isFollowing);
      setFollowersCount(data.followersCount);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [userId, authorHint, clerkUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const userPosts = useMemo(() => {
    if (!profile) return [];
    if (isOwnProfile) {
      return allPosts.filter(
        (p) => p.author.id === 'me' || p.author.id === profile.id || p.isOwnPost
      );
    }
    return allPosts.filter((p) => p.author.id === profile.id);
  }, [allPosts, profile, isOwnProfile]);

  const savedPosts = useMemo(() => {
    return allPosts.filter((p) => p.isBookmarked);
  }, [allPosts]);

  const handleToggleFollow = async () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setFollowersCount((prev) => (nextFollowing ? prev + 1 : Math.max(0, prev - 1)));
    await userProfileService.toggleFollowUser(profile.id);
  };

  const handleShareProfile = async () => {
    Haptics.selectionAsync().catch(() => {});
    const shareUrl = `https://pyqdeck.in/community/u/${profile?.id || 'student'}`;
    try {
      await Share.share({
        message: `Check out ${profile?.name || 'Student'}'s profile on PyQdeck Community:\n${shareUrl}`,
      });
    } catch {}
  };

  const openEditModal = () => {
    if (!profile) return;
    Haptics.selectionAsync().catch(() => {});
    setEditName(profile.name);
    setEditBio(profile.bio);
    setEditCollege(profile.college);
    setEditBranch(profile.branch);
    setEditSemester(profile.semester);
    setEditLocation(profile.location || '');
    setEditAbout(profile.about || '');
    setEditGithub(profile.github || '');
    setEditLinkedin(profile.linkedin || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Name required', 'Please provide your full name.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSavingEdit(true);

    const updated = await userProfileService.updateOwnProfile({
      name: editName.trim(),
      bio: editBio.trim() || 'Student • PYQDeck Community',
      college: editCollege.trim() || 'Bihar Engineering University',
      branch: editBranch.trim() || 'Engineering',
      semester: editSemester.trim() || 'B.Tech',
      location: editLocation.trim() || 'Bihar, India',
      about: editAbout.trim(),
      github: editGithub.trim(),
      linkedin: editLinkedin.trim(),
    });

    setProfile(updated);
    setSavingEdit(false);
    setEditModalVisible(false);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  };

  if (loading || !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Top App Bar with safe insets and guaranteed vertical Y-centering */}
      <View style={[styles.navBarWrapper, { paddingTop: insets.top }]}>
        <View style={styles.navBarInner}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.navBarBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={21} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.navBarTitle} numberOfLines={1}>
            {profile.name}
          </Text>

          <TouchableOpacity
            onPress={handleShareProfile}
            style={styles.navBarBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Share profile"
          >
            <Feather name="share-2" size={20} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenContainer variant="read" gutter={false}>
          {/* LinkedIn Hero Profile Card */}
          <View style={styles.heroCard}>
            {/* Cover Banner */}
            <View style={styles.coverWrap}>
              <Image
                source={{ uri: profile.coverUrl }}
                style={styles.coverImage}
                contentFit="cover"
              />
              <View style={styles.coverOverlay} />
            </View>

            {/* Avatar Row */}
            <View style={styles.avatarRow}>
              <View style={styles.avatarBorderWrap}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {getInitials(profile.name)}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* User Meta Information & Actions */}
            <View style={styles.profileMetaContent}>
              <View style={styles.nameHeaderRow}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <View style={styles.studentRoleBadge}>
                  <Text style={styles.studentRoleBadgeText}>STUDENT</Text>
                </View>
              </View>

              <Text style={styles.profileBio}>{profile.bio}</Text>

              {/* College & University Affiliation */}
              <View style={styles.infoMetaRow}>
                <Feather name="book-open" size={14} color={COLORS.primary} style={styles.metaIcon} />
                <Text style={styles.metaInstitutionText} numberOfLines={1}>
                  {profile.college}
                </Text>
              </View>

              <View style={styles.infoMetaRow}>
                <Feather name="map-pin" size={13.5} color="#6b7280" style={styles.metaIcon} />
                <Text style={styles.metaSubText}>{profile.location || 'Bihar, India'}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaSubText}>{profile.university}</Text>
              </View>

              {/* Social / Portfolio Links */}
              {(profile.github || profile.linkedin) && (
                <View style={styles.socialLinksRow}>
                  {profile.linkedin ? (
                    <TouchableOpacity
                      style={styles.socialPill}
                      onPress={async () => {
                        await Clipboard.setStringAsync(`https://linkedin.com/in/${profile.linkedin}`);
                        Alert.alert('Copied', 'LinkedIn profile URL copied to clipboard');
                      }}
                    >
                      <Feather name="linkedin" size={13} color="#0a66c2" />
                      <Text style={styles.socialPillText}>LinkedIn</Text>
                    </TouchableOpacity>
                  ) : null}

                  {profile.github ? (
                    <TouchableOpacity
                      style={styles.socialPill}
                      onPress={async () => {
                        await Clipboard.setStringAsync(`https://github.com/${profile.github}`);
                        Alert.alert('Copied', 'GitHub profile URL copied to clipboard');
                      }}
                    >
                      <Feather name="github" size={13} color="#111827" />
                      <Text style={styles.socialPillText}>GitHub</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Profile Action Buttons Row (Full-width below bio) */}
              <View style={styles.actionButtonsRow}>
                {isOwnProfile ? (
                  <>
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={openEditModal}
                      activeOpacity={0.8}
                    >
                      <Feather name="edit-2" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryActionBtnText}>Edit profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={handleShareProfile}
                      activeOpacity={0.8}
                    >
                      <Feather name="share-2" size={14} color="#374151" style={{ marginRight: 6 }} />
                      <Text style={styles.secondaryActionBtnText}>Share</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        isFollowing && styles.followingActionBtn,
                      ]}
                      onPress={handleToggleFollow}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name={isFollowing ? 'check' : 'user-plus'}
                        size={14}
                        color={isFollowing ? '#374151' : '#ffffff'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.primaryActionBtnText,
                          isFollowing && styles.followingActionBtnText,
                        ]}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryActionBtn}
                      onPress={handleShareProfile}
                      activeOpacity={0.8}
                    >
                      <Feather name="share-2" size={14} color="#374151" style={{ marginRight: 6 }} />
                      <Text style={styles.secondaryActionBtnText}>Share</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Network / Community Impact Statistics */}
              <View style={styles.statsRibbon}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{followersCount}</Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{profile.followingCount}</Text>
                  <Text style={styles.statLabel}>Following</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{userPosts.length}</Text>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{profile.upvotesCount}</Text>
                  <Text style={styles.statLabel}>Upvotes</Text>
                </View>
              </View>
            </View>
          </View>

          {/* LinkedIn-style Navigation Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'posts' && styles.tabItemActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('posts');
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'posts' && styles.tabLabelActive,
                ]}
              >
                Posts ({userPosts.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'about' && styles.tabItemActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('about');
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'about' && styles.tabLabelActive,
                ]}
              >
                About
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'contributions' && styles.tabItemActive]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab('contributions');
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === 'contributions' && styles.tabLabelActive,
                ]}
              >
                Contributions
              </Text>
            </TouchableOpacity>

            {isOwnProfile && (
              <TouchableOpacity
                style={[styles.tabItem, activeTab === 'saved' && styles.tabItemActive]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveTab('saved');
                }}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === 'saved' && styles.tabLabelActive,
                  ]}
                >
                  Saved ({savedPosts.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tab 1: Posts */}
          {activeTab === 'posts' && (
            <View style={styles.tabContentSection}>
              {userPosts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="file-text" size={32} color="#9ca3af" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyCardTitle}>No posts published yet</Text>
                  <Text style={styles.emptyCardSubtitle}>
                    {isOwnProfile
                      ? 'Share notes, ask questions, or solve PYQ doubts with your peers!'
                      : `${profile.name} hasn't posted in the community yet.`}
                  </Text>
                </View>
              ) : (
                userPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    showDismissAction={false}
                    onLikePress={(id) => communityStore.toggleLikePost(id)}
                    onBookmarkPress={(id) => communityStore.toggleBookmarkPost(id)}
                    onHashtagPress={(tag) => {
                      navigation.navigate('CommunityFeed', { filterHashtag: tag });
                    }}
                  />
                ))
              )}
            </View>
          )}

          {/* Tab 2: About & Academics */}
          {activeTab === 'about' && (
            <View style={styles.tabContentSection}>
              {/* About Narrative Card */}
              <View style={styles.contentCard}>
                <Text style={styles.cardSectionTitle}>About</Text>
                <Text style={styles.aboutBodyText}>
                  {profile.about || 'Engineering student preparing for university exams with PYQDeck.'}
                </Text>
              </View>

              {/* Academic Details Card */}
              <View style={styles.contentCard}>
                <Text style={styles.cardSectionTitle}>Academic Overview</Text>

                <View style={styles.academicRow}>
                  <View style={styles.academicIconWrap}>
                    <Feather name="award" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.academicMeta}>
                    <Text style={styles.academicTitle}>Bachelor of Technology (B.Tech)</Text>
                    <Text style={styles.academicSubtitle}>{profile.branch}</Text>
                    <Text style={styles.academicDetailText}>
                      {profile.semester} • Class of {profile.gradYear || '2026'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.academicRow, { marginTop: 14 }]}>
                  <View style={styles.academicIconWrap}>
                    <Feather name="home" size={18} color={COLORS.primary} />
                  </View>
                  <View style={styles.academicMeta}>
                    <Text style={styles.academicTitle}>{profile.college}</Text>
                    <Text style={styles.academicSubtitle}>
                      Affiliated to Bihar Engineering University, Patna
                    </Text>
                  </View>
                </View>
              </View>

              {/* Skills & Focus Card */}
              {profile.skills && profile.skills.length > 0 && (
                <View style={styles.contentCard}>
                  <Text style={styles.cardSectionTitle}>Core Subjects & Skills</Text>
                  <View style={styles.skillsWrap}>
                    {profile.skills.map((skill, index) => (
                      <View key={index} style={styles.skillBadge}>
                        <Text style={styles.skillBadgeText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Tab 3: Contributions */}
          {activeTab === 'contributions' && (
            <View style={styles.tabContentSection}>
              <View style={styles.contentCard}>
                <Text style={styles.cardSectionTitle}>PYQ & Notes Contributions</Text>
                <Text style={styles.contributionIntro}>
                  Exam question papers, handwritten solution sheets, and verified notes shared by {profile.name}.
                </Text>

                <View style={styles.contributionItem}>
                  <View style={styles.contributionIconWrap}>
                    <Feather name="file-text" size={18} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contributionItemTitle}>
                      {profile.branch} 2023 End-Sem Exam Papers
                    </Text>
                    <Text style={styles.contributionItemSub}>
                      Verified by PYQDeck Team • 420+ Downloads
                    </Text>
                  </View>
                  <View style={styles.verifiedContributionBadge}>
                    <Feather name="check" size={12} color={COLORS.success} />
                  </View>
                </View>

                <View style={[styles.contributionItem, { marginTop: 12 }]}>
                  <View style={styles.contributionIconWrap}>
                    <Feather name="image" size={18} color="#0a66c2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contributionItemTitle}>
                      Module 3 & 4 Handwritten Diagrams & Solutions
                    </Text>
                    <Text style={styles.contributionItemSub}>
                      High-Yield University Revision Notes • 180+ Saves
                    </Text>
                  </View>
                  <View style={styles.verifiedContributionBadge}>
                    <Feather name="check" size={12} color={COLORS.success} />
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Tab 4: Saved / Bookmarked Posts (Own Profile Only) */}
          {activeTab === 'saved' && isOwnProfile && (
            <View style={styles.tabContentSection}>
              {savedPosts.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Feather name="bookmark" size={32} color="#9ca3af" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyCardTitle}>No saved posts</Text>
                  <Text style={styles.emptyCardSubtitle}>
                    Save important PYQ solutions and notes to study later!
                  </Text>
                </View>
              ) : (
                savedPosts.map((post) => (
                  <CommunityPostCard
                    key={post.id}
                    post={post}
                    showDismissAction={false}
                    onLikePress={(id) => communityStore.toggleLikePost(id)}
                    onBookmarkPress={(id) => communityStore.toggleBookmarkPost(id)}
                    onHashtagPress={(tag) => {
                      navigation.navigate('CommunityFeed', { filterHashtag: tag });
                    }}
                  />
                ))
              )}
            </View>
          )}
        </ScreenContainer>
      </ScrollView>

      {/* Edit Profile Bottom Sheet Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContainer}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setEditModalVisible(false)}
              hitSlop={8}
              style={styles.modalCloseBtn}
            >
              <Feather name="x" size={20} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={savingEdit}
              style={styles.modalSaveBtn}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalSaveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your full name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Headline / Bio *</Text>
              <TextInput
                style={styles.fieldInput}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="e.g. CSE 3rd Year • Core CS & Systems"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.fieldHint}>
                Appears under your name in community posts and discussion threads.
              </Text>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Engineering College</Text>
              <TextInput
                style={styles.fieldInput}
                value={editCollege}
                onChangeText={setEditCollege}
                placeholder="e.g. BCE Bhagalpur / MIT Muzaffarpur"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formField, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Branch</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editBranch}
                  onChangeText={setEditBranch}
                  placeholder="e.g. CSE / ECE / ME"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={[styles.formField, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Semester</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editSemester}
                  onChangeText={setEditSemester}
                  placeholder="e.g. 6th Semester"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.fieldInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="e.g. Patna, Bihar"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>About You</Text>
              <TextInput
                style={[styles.fieldInput, styles.textAreaInput]}
                value={editAbout}
                onChangeText={setEditAbout}
                multiline
                numberOfLines={4}
                placeholder="Write a brief overview about your engineering interests, exam prep, or study goals..."
                placeholderTextColor="#9ca3af"
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>GitHub Username</Text>
              <TextInput
                style={styles.fieldInput}
                value={editGithub}
                onChangeText={setEditGithub}
                placeholder="e.g. your-github-handle"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>LinkedIn Username</Text>
              <TextInput
                style={styles.fieldInput}
                value={editLinkedin}
                onChangeText={setEditLinkedin}
                placeholder="e.g. your-linkedin-handle"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  navBarWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    zIndex: 10,
  },
  navBarInner: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  navBarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  navBarTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16.5,
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    lineHeight: 22,
    includeFontPadding: false,
  },
  scrollView: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  coverWrap: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: COLORS.primary,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  avatarRow: {
    paddingHorizontal: 16,
    marginTop: -45,
  },
  avatarBorderWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    borderWidth: 4,
    borderColor: '#ffffff',
    borderRadius: 48,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#f3f4f6',
  },
  avatarFallback: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  avatarFallbackText: {
    fontFamily: FONTS.displayBold,
    fontSize: 30,
    color: '#1d4ed8',
  },
  profileMetaContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: '#111827',
    lineHeight: 26,
  },
  studentRoleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  studentRoleBadgeText: {
    fontFamily: FONTS.displayBold,
    fontSize: 10,
    color: COLORS.success,
    letterSpacing: 0.4,
  },
  profileBio: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginTop: 4,
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  metaIcon: {
    marginRight: 6,
  },
  metaInstitutionText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 13,
    color: '#1f2937',
    flex: 1,
  },
  metaSubText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: '#6b7280',
  },
  metaDot: {
    marginHorizontal: 5,
    color: '#9ca3af',
  },
  socialLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  socialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  socialPillText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: '#374151',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  primaryActionBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  followingActionBtn: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  followingActionBtnText: {
    color: '#374151',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 20,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  secondaryActionBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#374151',
  },
  statsRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: FONTS.displayBold,
    fontSize: 15.5,
    color: '#111827',
  },
  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e5e7eb',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabLabel: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#6b7280',
  },
  tabLabelActive: {
    fontFamily: FONTS.displayBold,
    color: COLORS.primary,
  },
  tabContentSection: {
    gap: 0,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 8,
  },
  cardSectionTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    color: '#111827',
    marginBottom: 10,
  },
  aboutBodyText: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: '#374151',
    lineHeight: 20,
  },
  academicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  academicIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  academicMeta: {
    flex: 1,
  },
  academicTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: '#111827',
  },
  academicSubtitle: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12.5,
    color: '#4b5563',
    marginTop: 1,
  },
  academicDetailText: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: '#6b7280',
    marginTop: 2,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  skillBadgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: '#374151',
  },
  contributionIntro: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  contributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  contributionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contributionItemTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#111827',
  },
  contributionItemSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  verifiedContributionBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    paddingVertical: 36,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 14.5,
    color: '#111827',
  },
  emptyCardSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 260,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: '#111827',
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
  },
  modalSaveBtnText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#ffffff',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    gap: 14,
  },
  formField: {
    gap: 5,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 12.5,
    color: '#374151',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  textAreaInput: {
    minHeight: 80,
    paddingTop: 9,
  },
  fieldHint: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
});
