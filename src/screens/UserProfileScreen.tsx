import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Linking,
  Animated,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { useUser } from '@clerk/expo';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ScreenContainer } from '../components/ScreenContainer';
import { CommunityPostCard } from '../components/community/CommunityPostCard';
import { CommunityCommentsBottomSheet } from '../components/community/CommunityCommentsBottomSheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { communityKeys } from '@pyqdeck/community-sdk';
import { COMMUNITY_SLUG } from '../community/config';
import { toggleBookmarkPost, toggleLikePost } from '../community/actions';
import { profileQuery, useBookmarks, useMemberPosts } from '../community/queries';
import { promptReport } from '../community/reportPrompt';
import { useRequireAuth } from '../auth/useRequireAuth';
import { alertCommunityError } from '../community/errors';
import { CommunityAuthor, CommunityPost } from '../types/community';
import {
  userProfileService,
  UserProfileData,
} from '../services/userProfileService';
import { EditProfileModal } from '../components/profile/EditProfileModal';

const getLinkedInUrl = (input?: string) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const handle = trimmed.replace(/^[@/]+/, '');
  return `https://www.linkedin.com/in/${handle}`;
};

const getGitHubUrl = (input?: string) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const handle = trimmed.replace(/^[@/]+/, '');
  return `https://github.com/${handle}`;
};

const getWebsiteUrl = (input?: string) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const getTwitterUrl = (input?: string) => {
  if (!input) return '';
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const handle = trimmed.replace(/^[@/]+/, '');
  return `https://x.com/${handle}`;
};

export const UserProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user: clerkUser } = useUser();
  const { guard, isSignedIn, isLoaded: authLoaded } = useRequireAuth();

  const { userId = 'me', author: authorHint } = (route.params || {}) as {
    userId?: string;
    author?: CommunityAuthor;
  };

  const isOwnProfile =
    userId === 'me' || (clerkUser?.id && userId === clerkUser.id);

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'saved'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const { width: windowWidth } = useWindowDimensions();

  const tabs: ('posts' | 'about' | 'saved')[] = useMemo(
    () => (isOwnProfile ? ['posts', 'about', 'saved'] : ['posts', 'about']),
    [isOwnProfile]
  );

  const tabWidth = windowWidth / tabs.length;
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabScrollRef = useRef<ScrollView>(null);
  // Measured content height of each tab page, so the pager only takes the height of the visible page
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const onPageLayout = (index: number) => (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setPageHeights((prev) => {
      if (prev[index] === h) return prev;
      const next = [...prev];
      next[index] = h;
      return next;
    });
  };
  const pagerHeight = useMemo(() => {
    const ready = tabs.every((_, i) => (pageHeights[i] ?? 0) > 0);
    if (!ready) return undefined;
    return scrollX.interpolate({
      inputRange: tabs.map((_, i) => i * windowWidth),
      outputRange: tabs.map((_, i) => pageHeights[i]),
      extrapolate: 'clamp',
    });
  }, [tabs, pageHeights, windowWidth, scrollX]);

  const indicatorTranslateX = useMemo(() => {
    return scrollX.interpolate({
      inputRange: tabs.map((_, i) => i * windowWidth),
      outputRange: tabs.map((_, i) => i * tabWidth),
      extrapolate: 'clamp',
    });
  }, [tabs, windowWidth, tabWidth, scrollX]);

  const handleTabPress = (tab: typeof tabs[number], index: number) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveTab(tab);
    tabScrollRef.current?.scrollTo({ x: index * windowWidth, animated: true });
  };

  const getTabLabel = (tab: typeof tabs[number]) => {
    switch (tab) {
      case 'posts':
        return 'Posts';
      case 'about':
        return 'About';
      case 'saved':
        return `Saved (${savedPosts.length})`;
    }
  };

  // Edit profile modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [notificationsActive, setNotificationsActive] = useState(false);
  const [commentSheetPost, setCommentSheetPost] = useState<CommunityPost | null>(null);

  // Posts, saved posts and the profile itself are TanStack Queries (cached, saved offline, updated in place by likes).
  const queryClient = useQueryClient();
  const profileQ = useQuery(profileQuery(userId, clerkUser?.id));
  const memberPostsQ = useMemberPosts(profile?.id);
  const bookmarksQ = useBookmarks(!!isOwnProfile);
  const userPosts: CommunityPost[] = memberPostsQ.data ?? [];
  const savedPosts: CommunityPost[] = bookmarksQ.data ?? [];
  const allPosts = useMemo(() => [...userPosts, ...savedPosts], [userPosts, savedPosts]);

  // Keep commentSheetPost in sync with cache updates
  useEffect(() => {
    if (commentSheetPost) {
      const updated = allPosts.find((p) => p.id === commentSheetPost.id);
      if (updated && updated !== commentSheetPost) {
        setCommentSheetPost(updated);
      }
    }
  }, [allPosts, commentSheetPost]);

  const handleOpenDetail = useCallback(
    (post: CommunityPost, focusComments = false) => {
      navigation.navigate('CommunityPostDetail', {
        postId: post.id,
        initialPost: post,
        focusComments,
      });
    },
    [navigation]
  );

  useEffect(() => {
    if (profileQ.data) {
      setProfile(profileQ.data);
      setIsFollowing(!!profileQ.data.isFollowing);
      setFollowersCount(profileQ.data.followersCount);
      setLoading(false);
    } else if (profileQ.isError) {
      setLoading(false);
    }
  }, [profileQ.data, profileQ.isError]);

  const handleToggleFollow = () => guard(doToggleFollow, 'follow');

  const doToggleFollow = async () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setFollowersCount((prev) => (nextFollowing ? prev + 1 : Math.max(0, prev - 1)));
    try {
      await userProfileService.toggleFollowUser(profile.id);
    } catch (err) {
      setIsFollowing(!nextFollowing);
      setFollowersCount((prev) => (nextFollowing ? Math.max(0, prev - 1) : prev + 1));
      alertCommunityError(err, 'Could not update follow');
    }
  };

  const handleToggleNotifications = () => {
    Haptics.selectionAsync().catch(() => {});
    const nextState = !notificationsActive;
    setNotificationsActive(nextState);
    Alert.alert(
      nextState ? 'Notifications turned on' : 'Notifications turned off',
      nextState
        ? isOwnProfile
          ? 'You will receive notifications for activity on your profile and contributions.'
          : `You will now receive notifications when ${profile?.name || 'this student'} posts or shares updates.`
        : isOwnProfile
          ? 'Profile activity notifications paused.'
          : `Notifications muted for ${profile?.name || 'this student'}.`
    );
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

  const handleOpenSocialUrl = async (url: string) => {
    if (!url) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#ffffff',
        controlsColor: COLORS.primary,
        secondaryToolbarColor: '#f9fafb',
        showTitle: true,
        enableBarCollapsing: true,
      });
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Unable to open link', 'Could not open the webpage. Please check your network connection.');
      }
    }
  };

  const handleOpenMessage = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      'Direct Messages',
      `Direct messaging with ${profile?.name || 'this student'} will be available in the upcoming peer study update!`,
      [{ text: 'OK' }]
    );
  };

  const handleOpenMoreOptions = () => {
    Haptics.selectionAsync().catch(() => {});
    Alert.alert(
      profile?.name || 'Profile Options',
      'Select an action',
      [
        {
          text: 'Share Profile',
          onPress: handleShareProfile,
        },
        {
          text: 'Copy Profile Link',
          onPress: async () => {
            const shareUrl = `https://pyqdeck.in/community/u/${profile?.id || 'student'}`;
            try {
              await Clipboard.setStringAsync(shareUrl);
              Alert.alert('Copied', 'Profile URL copied to clipboard');
            } catch {}
          },
        },
        !isOwnProfile
          ? {
              text: 'Report Student',
              style: 'destructive',
              onPress: () => guard(() => promptReport('member', profile?.id ?? ''), 'flag'),
            }
          : null,
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ].filter(Boolean) as any
    );
  };

  const openEditModal = () => {
    if (!profile) return;
    Haptics.selectionAsync().catch(() => {});
    setEditModalVisible(true);
  };

  const handleSaveProfile = async (updates: Partial<UserProfileData>) => {
    try {
      const updated = await userProfileService.updateOwnProfile(updates);
      setProfile(updated);
      queryClient.setQueryData(communityKeys.me(COMMUNITY_SLUG), updated);
    } catch (err) {
      alertCommunityError(err, 'Could not save your profile');
      throw err;
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  };

  // Your own profile needs an account; a profile that could not load says so instead of spinning forever.
  if (isOwnProfile && authLoaded && !isSignedIn) {
    return (
      <View style={[styles.loadingContainer, { paddingHorizontal: 32 }]}>
        <Text style={{ fontFamily: FONTS.displayBold, fontSize: 18, color: COLORS.text, textAlign: 'center' }}>
          Sign in or create an account to see your profile
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8 }}>
          Your posts, saved posts and followers live in your community profile.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('SignIn', { reason: 'community' })}
          style={{ marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full }}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: FONTS.bodySemi, color: '#ffffff', fontSize: 14 }}>Sign in or create account</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!profile && profileQ.isError) {
    return (
      <View style={[styles.loadingContainer, { paddingHorizontal: 32 }]}>
        <Text style={{ fontFamily: FONTS.displayBold, fontSize: 18, color: COLORS.text, textAlign: 'center' }}>
          Could not load this profile
        </Text>
        <TouchableOpacity
          onPress={() => void profileQ.refetch()}
          style={{ marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full }}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: FONTS.bodySemi, color: '#ffffff', fontSize: 14 }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

              <TouchableOpacity
                style={[styles.bellBtn, notificationsActive && styles.bellBtnActive]}
                onPress={handleToggleNotifications}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={
                  notificationsActive
                    ? 'Turn off notifications'
                    : 'Turn on notifications'
                }
                activeOpacity={0.7}
              >
                <Feather
                  name="bell"
                  size={18}
                  color={notificationsActive ? COLORS.primary : '#4b5563'}
                />
                {notificationsActive && <View style={styles.bellActiveDot} />}
              </TouchableOpacity>
            </View>

            {/* User Meta Information & Actions */}
            <View style={styles.profileMetaContent}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileBio}>{profile.bio}</Text>

              {/* Address & College */}
              <View style={styles.infoMetaRow}>
                <Feather name="map-pin" size={12.5} color="#6b7280" style={styles.metaInlineIcon} />
                <Text style={styles.metaAddressText} numberOfLines={1}>
                  {profile.location || 'Bihar, India'}
                </Text>

                {profile.college ? (
                  <>
                    <Text style={styles.metaDot}>•</Text>
                    <Ionicons name="school-outline" size={13.5} color="#6b7280" style={styles.metaInlineIcon} />
                    <Text
                      style={styles.metaCollegeText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {profile.college}
                    </Text>
                  </>
                ) : null}
              </View>

              {/* Social / Portfolio Links */}
              {(profile.github || profile.linkedin || profile.website || profile.twitter) && (
                <View style={styles.socialLinksRow}>
                  {profile.website ? (
                    <TouchableOpacity
                      style={[styles.socialIconBtn, styles.websiteIconBtn]}
                      onPress={() => handleOpenSocialUrl(getWebsiteUrl(profile.website))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Open Portfolio or Personal Website"
                      activeOpacity={0.7}
                    >
                      <Feather name="globe" size={16} color="#0d9488" />
                    </TouchableOpacity>
                  ) : null}

                  {profile.linkedin ? (
                    <TouchableOpacity
                      style={[styles.socialIconBtn, styles.linkedinIconBtn]}
                      onPress={() => handleOpenSocialUrl(getLinkedInUrl(profile.linkedin))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Open LinkedIn profile"
                      activeOpacity={0.7}
                    >
                      <Feather name="linkedin" size={16} color="#0a66c2" />
                    </TouchableOpacity>
                  ) : null}

                  {profile.github ? (
                    <TouchableOpacity
                      style={[styles.socialIconBtn, styles.githubIconBtn]}
                      onPress={() => handleOpenSocialUrl(getGitHubUrl(profile.github))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Open GitHub profile"
                      activeOpacity={0.7}
                    >
                      <Feather name="github" size={16} color="#111827" />
                    </TouchableOpacity>
                  ) : null}

                  {profile.twitter ? (
                    <TouchableOpacity
                      style={[styles.socialIconBtn, styles.twitterIconBtn]}
                      onPress={() => handleOpenSocialUrl(getTwitterUrl(profile.twitter))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Open X (Twitter) profile"
                      activeOpacity={0.7}
                    >
                      <Feather name="twitter" size={16} color="#0284c7" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              {/* Network Stats (Followers & Following) */}
              <View style={styles.networkRow}>
                <Text style={styles.networkText}>
                  <Text style={styles.networkBold}>{followersCount}</Text>
                  {' followers'}
                  <Text style={styles.networkDot}> • </Text>
                  <Text style={styles.networkBold}>{profile.followingCount}</Text>
                  {' following'}
                </Text>
              </View>

              {/* Profile Action Buttons Row (Follow, Message, More) */}
              <View style={styles.actionButtonsRow}>
                {isOwnProfile ? (
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={openEditModal}
                    activeOpacity={0.8}
                  >
                    <Feather name="edit-2" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryActionBtnText}>Edit profile</Text>
                  </TouchableOpacity>
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
                      onPress={handleOpenMessage}
                      activeOpacity={0.8}
                    >
                      <Feather name="message-circle" size={15} color="#374151" style={{ marginRight: 6 }} />
                      <Text style={styles.secondaryActionBtnText}>Message</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.moreActionBtn}
                      onPress={handleOpenMoreOptions}
                      activeOpacity={0.8}
                      accessibilityLabel="More profile options"
                    >
                      <Feather name="more-vertical" size={18} color="#374151" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Navigation Tabs with Smooth Animated Sliding Indicator */}
          <View style={styles.tabBar}>
            {tabs.map((tab, index) => {
              const isSelected = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={styles.tabItem}
                  onPress={() => handleTabPress(tab, index)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      isSelected && styles.tabLabelActive,
                    ]}
                  >
                    {getTabLabel(tab)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Sliding Indicator Line */}
            <Animated.View
              style={[
                styles.tabActiveIndicator,
                {
                  width: tabWidth,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />
          </View>

          {/* Horizontal Swiping Tab Pages */}
          <Animated.View style={pagerHeight ? { height: pagerHeight, overflow: 'hidden' } : undefined}>
          <ScrollView
            ref={tabScrollRef}
            horizontal
            style={pagerHeight ? { flex: 1 } : undefined}
            contentContainerStyle={{ alignItems: 'flex-start' }}
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            onMomentumScrollEnd={(e) => {
              const pageIndex = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
              const selectedTab = tabs[pageIndex];
              if (selectedTab && selectedTab !== activeTab) {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab(selectedTab);
              }
            }}
          >
            {/* Page 1: Posts */}
            <View style={{ width: windowWidth }} onLayout={onPageLayout(0)}>
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
                      onLikePress={(id) => void toggleLikePost(id)}
                      onBookmarkPress={(id) => void toggleBookmarkPost(id)}
                      onCommentPress={(p) => setCommentSheetPost(p)}
                      onOpenDetail={(p) => handleOpenDetail(p, false)}
                      onHashtagPress={(tag) => {
                        navigation.navigate('CommunityFeed', { filterHashtag: tag });
                      }}
                    />
                  ))
                )}
              </View>
            </View>

            {/* Page 2: About & Academics */}
            <View style={{ width: windowWidth }} onLayout={onPageLayout(1)}>
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
                        {(() => {
                          const s = (profile.semester || '').toLowerCase();
                          const isAlumni =
                            s.includes('alumn') ||
                            s.includes('graduat') ||
                            s.includes('passout') ||
                            s.includes('passed');
                          if (isAlumni) {
                            return profile.gradYear
                              ? `Alumni • Batch of ${profile.gradYear}`
                              : 'Alumni (Passed Out)';
                          }
                          return `${profile.semester} • Class of ${profile.gradYear || '2026'}`;
                        })()}
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
            </View>

            {/* Page 4: Saved / Bookmarked Posts (Own Profile Only) */}
            {isOwnProfile && (
              <View style={{ width: windowWidth }} onLayout={onPageLayout(2)}>
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
                        onLikePress={(id) => void toggleLikePost(id)}
                        onBookmarkPress={(id) => void toggleBookmarkPost(id)}
                        onCommentPress={(p) => setCommentSheetPost(p)}
                        onOpenDetail={(p) => handleOpenDetail(p, false)}
                        onHashtagPress={(tag) => {
                          navigation.navigate('CommunityFeed', { filterHashtag: tag });
                        }}
                      />
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>
          </Animated.View>
        </ScreenContainer>
      </ScrollView>

      {/* Modern Edit Profile Modal with Full Keyboard Handling & Photo Pickers */}
      {profile && (
        <EditProfileModal
          visible={editModalVisible}
          profile={profile}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveProfile}
        />
      )}

      {/* LinkedIn-Style Comments Bottom Sheet */}
      <CommunityCommentsBottomSheet
        visible={!!commentSheetPost}
        post={commentSheetPost}
        onClose={() => setCommentSheetPost(null)}
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  bellBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#eff6ff',
  },
  bellActiveDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  avatarBorderWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
    borderWidth: 4,
    borderColor: '#ffffff',
    borderRadius: 48,
    backgroundColor: '#ffffff',
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
  profileName: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: '#111827',
    lineHeight: 26,
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
  metaInlineIcon: {
    marginRight: 4,
    flexShrink: 0,
  },
  metaAddressText: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#6b7280',
    flexShrink: 0,
    maxWidth: '45%',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#9ca3af',
    fontSize: 12,
    flexShrink: 0,
  },
  metaCollegeText: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#6b7280',
    flex: 1,
    flexShrink: 1,
  },
  socialLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 11,
  },
  socialIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  linkedinIconBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  githubIconBtn: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  websiteIconBtn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  twitterIconBtn: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 16,
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
  moreActionBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    borderWidth: 1.2,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  networkText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: '#6b7280',
  },
  networkBold: {
    fontFamily: FONTS.displayBold,
    color: '#111827',
  },
  networkDot: {
    color: '#9ca3af',
  },
  tabBar: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActiveIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
  },
  tabLabel: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12.5,
    color: '#6b7280',
    textAlign: 'center',
  },
  tabLabelActive: {
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
});
