import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/expo';
import { isAuthEnabled } from '../config/features';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { CommunityPost, PendingPostUpload } from '../types/community';
import { useCommunityFeed } from '../community/queries';
import { usePendingUploads, cancelPostUpload } from '../community/uploads';

const COMMUNITY_JOIN_DISMISSED_KEY = 'pyqdeck:community_join_dismissed';
import { hidePost, toggleBookmarkPost, toggleLikePost } from '../community/actions';
import { describeCommunityError } from '../community/errors';
import { useRequireAuth } from '../auth/useRequireAuth';
import { CommunityPostCard } from '../components/community/CommunityPostCard';
import { PendingPostCard } from '../components/community/PendingPostCard';
import { CreateCommunityPostModal } from '../components/community/CreateCommunityPostModal';
import { CommunityCommentsBottomSheet } from '../components/community/CommunityCommentsBottomSheet';
import { CommunityInlineAdCard } from '../components/community/CommunityInlineAdCard';
import { NewPostIcon } from '../components/community/NewPostIcon';
import { ScreenContainer } from '../components/ScreenContainer';
import { CommunityFeedSkeleton } from '../components/Skeletons';
import { useAppConfig } from '../config/useAppConfig';
import { useAdsEntitlement } from '../utils/adsEntitlement';
import { adsAvailable } from '../utils/mobileAds';
import { rf } from '../utils/responsive';

import { enableLayoutAnimation } from '../utils/layoutAnimation';

enableLayoutAnimation();

type FeedItem =
  | { type: 'post'; post: CommunityPost }
  | { type: 'ad'; id: string };

export const CommunityFeedScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { guard } = useRequireAuth();

  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(
    route.params?.filterHashtag || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentSheetPost, setCommentSheetPost] = useState<CommunityPost | null>(null);
  const pendingUploads = usePendingUploads();

  // Remember dismissal of the "Join the BEU community" card across sessions (same as Study tab's SyncStatusBar)
  const [joinDismissed, setJoinDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(COMMUNITY_JOIN_DISMISSED_KEY)
      .then((v) => setJoinDismissed(v === '1'))
      .catch(() => setJoinDismissed(false));
  }, []);

  const dismissJoinCard = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setJoinDismissed(true);
    AsyncStorage.setItem(COMMUNITY_JOIN_DISMISSED_KEY, '1').catch(() => {});
  };

  // The feed is a TanStack Query: cached and saved offline, refetched when stale, paged by cursor. The server does
  // the hashtag filter and the search, so the list shown is exactly what it returned. Search waits for a pause in typing.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const feed = useCommunityFeed({ hashtag: selectedHashtag, q: debouncedQuery });
  const posts = feed.posts;
  const isLoading = feed.isPending;
  const feedError = feed.isError && posts.length === 0 ? describeCommunityError(feed.error) : null;
  const loadingMore = feed.isFetchingNextPage;

  // Sync route params if navigated with filter
  useEffect(() => {
    if (route.params?.filterHashtag) {
      setSelectedHashtag(route.params.filterHashtag);
    }
  }, [route.params?.filterHashtag]);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await feed.refetch();
    setRefreshing(false);
  };

  const filteredPosts = posts;

  const { flags } = useAppConfig();
  const entitlement = useAdsEntitlement();
  const canShowAds = flags.adsEnabled !== false && !entitlement.adFree && (adsAvailable || __DEV__);

  // Interleave inline feed ads (e.g. after 3rd post, then every 5 posts)
  const feedItems = useMemo<FeedItem[]>(() => {
    if (!canShowAds || filteredPosts.length < 3) {
      return filteredPosts.map((post) => ({ type: 'post' as const, post }));
    }

    const items: FeedItem[] = [];
    const FIRST_AD_OFFSET = 2; // After 3rd post (0-indexed: 0, 1, 2)
    const AD_CADENCE = 5;

    filteredPosts.forEach((post, index) => {
      items.push({ type: 'post', post });
      if (
        index === FIRST_AD_OFFSET ||
        (index > FIRST_AD_OFFSET && (index - FIRST_AD_OFFSET) % AD_CADENCE === 0)
      ) {
        items.push({ type: 'ad', id: `feed-inline-ad-${post.id}-${index}` });
      }
    });

    return items;
  }, [filteredPosts, canShowAds]);

  const handleOpenDetail = (post: CommunityPost, focusComments = false) => {
    navigation.navigate('CommunityPostDetail', {
      postId: post.id,
      initialPost: post,
      focusComments,
    });
  };

  const renderHeader = () => {
    return (
      <View>
        {/* Signed-out visitors can read everything; this is the way in to post, like and comment. */}
        {isAuthEnabled && !isSignedIn && joinDismissed === false ? (
          <View style={styles.joinCard}>
            <View style={styles.joinHeader}>
              <Text style={styles.joinTitle}>Join the BEU community</Text>
              <TouchableOpacity
                style={styles.joinCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss banner"
                onPress={dismissJoinCard}
              >
                <Feather name="x" size={16} color={COLORS.textSubtle} />
              </TouchableOpacity>
            </View>
            <Text style={styles.joinBody}>Create an account to post, comment, like and follow other students.</Text>
            <View style={styles.joinActions}>
              <TouchableOpacity
                style={styles.joinPrimary}
                onPress={() => navigation.navigate('SignIn', { reason: 'community' })}
                accessibilityRole="button"
                accessibilityLabel="Create account"
              >
                <Text style={styles.joinPrimaryText}>Create account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.joinSecondary}
                onPress={() => navigation.navigate('SignIn', { reason: 'community' })}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
              >
                <Text style={styles.joinSecondaryText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        {/* Optimistic Background Uploading Posts (like Twitter/X & LinkedIn) */}
        {pendingUploads.map((item) => (
          <PendingPostCard
            key={item.id}
            upload={item}
            onCancel={(id) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              cancelPostUpload(id);
            }}
          />
        ))}

        {/* Active Hashtag Filter Pill */}
        {selectedHashtag ? (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterText}>Filtered by #{selectedHashtag}</Text>
            <TouchableOpacity
              onPress={() => setSelectedHashtag(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderEmpty = () =>
    feedError ? (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Could not load the community</Text>
        <Text style={styles.emptySubtitle}>{feedError}</Text>
        <TouchableOpacity style={styles.emptyCtaBtn} onPress={onRefresh} activeOpacity={0.8}>
          <Text style={styles.emptyCtaText}>Try again</Text>
        </TouchableOpacity>
      </View>
    ) : (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <NewPostIcon size={32} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No posts found</Text>
      <Text style={styles.emptySubtitle}>
        {selectedHashtag
          ? `No posts tagged with #${selectedHashtag} yet.`
          : searchQuery
          ? `No results matching "${searchQuery}".`
          : 'Be the first to share notes, ask doubts, or post a discussion!'}
      </Text>
      <TouchableOpacity
        style={styles.emptyCtaBtn}
        onPress={() => guard(() => setCreateModalVisible(true), 'post')}
        activeOpacity={0.8}
      >
        <NewPostIcon size={16} color="#ffffff" />
        <Text style={styles.emptyCtaText}>Start a post</Text>
      </TouchableOpacity>
    </View>
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Site Header bar with Official PyQdeck Branding (like HomeScreen) */}
      <View style={styles.siteHeader}>
        {isSearchExpanded ? (
          <View style={styles.expandedSearchRow}>
            <View style={styles.expandedSearchInputContainer}>
              <Feather name="search" size={15} color={COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.expandedSearchInput}
                placeholder="Search posts, doubts, #tags..."
                placeholderTextColor={COLORS.textSubtle}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                returnKeyType="search"
              />
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsSearchExpanded(false);
                  setSearchQuery('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.searchCloseBtn}
                accessibilityLabel="Close search"
              >
                <Feather name="x" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.headerInner}>
            <TouchableOpacity
              style={styles.brandRow}
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setSelectedHashtag(null);
                setSearchQuery('');
              }}
            >
              <Image
                source={require('../../assets/app-icon.png')}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View style={styles.brandText}>
                <Text style={styles.brandTitle} numberOfLines={1}>PyQdeck</Text>
                <Text style={styles.brandSubtitle} numberOfLines={1}>BEU COMMUNITY</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsSearchExpanded(true);
                }}
                style={styles.headerSearchButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Search community"
              >
                <Feather name="search" size={19} color={COLORS.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  navigation.navigate('Tabs', { screen: 'Activity' });
                }}
                style={styles.headerMessageButton}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Messages & Activity"
              >
                <Feather name="message-circle" size={20} color={COLORS.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  if (isAuthEnabled && isSignedIn) {
                    navigation.navigate('UserProfile', { userId: 'me' });
                  } else {
                    navigation.navigate('Settings');
                  }
                }}
                style={[
                  styles.headerIconButton,
                  isAuthEnabled && isSignedIn && styles.headerIconButtonActive,
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={isAuthEnabled && isSignedIn ? 'My Profile' : 'Settings'}
              >
                {isAuthEnabled && isSignedIn ? (
                  user?.imageUrl ? (
                    <Image
                      source={{ uri: user.imageUrl }}
                      style={styles.headerAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.headerAvatarFallback}>
                      <Text style={styles.headerAvatarText}>
                        {(user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || 'U').toUpperCase()}
                      </Text>
                    </View>
                  )
                ) : (
                  <Feather name="settings" size={17} color={COLORS.text} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Main Feed Content or Loading Skeleton */}
      {isLoading ? (
        <ScreenContainer variant="read" gutter={false}>
          <CommunityFeedSkeleton />
        </ScreenContainer>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => (item.type === 'post' ? item.post.id : item.id)}
          renderItem={({ item }) => (
            <ScreenContainer variant="read" gutter={false}>
              {item.type === 'ad' ? (
                <CommunityInlineAdCard />
              ) : (
                <CommunityPostCard
                  post={item.post}
                  onHashtagPress={(tag) => setSelectedHashtag(tag)}
                  onCommentPress={(p) => setCommentSheetPost(p)}
                  onOpenDetail={(p) => handleOpenDetail(p, false)}
                  onDismissPost={(id) => void hidePost(id)}
                />
              )}
            </ScreenContainer>
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          onEndReachedThreshold={0.6}
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && void feed.fetchNextPage()}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        />
      )}

      {/* Floating Action Button for New Post (like Twitter/X & Reddit) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          guard(() => setCreateModalVisible(true), 'post');
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create new post"
      >
        <NewPostIcon size={19} color="#ffffff" />
        <Text style={styles.fabText}>Post</Text>
      </TouchableOpacity>

      {/* Create Post Modal */}
      <CreateCommunityPostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onPostCreated={() => {
          setSelectedHashtag(null);
        }}
      />

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
  joinCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primaryLight,
  },
  joinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  joinTitle: { flex: 1, fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  joinCloseBtn: {
    marginTop: -2,
    marginRight: -4,
    padding: 4,
  },
  joinBody: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  joinActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  joinPrimary: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  joinPrimaryText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: '#ffffff' },
  joinSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  joinSecondaryText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.primary },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  siteHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  brandText: {
    flexShrink: 1,
    minWidth: 0,
  },
  brandTitle: {
    fontFamily: FONTS.display,
    fontSize: rf(22),
    color: COLORS.text,
    letterSpacing: -0.6,
    lineHeight: rf(25),
  },
  brandSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: rf(9.5),
    color: COLORS.primary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginLeft: 8,
  },
  headerSearchButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMessageButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  headerIconButtonActive: {
    padding: 0,
    overflow: 'hidden',
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 19,
  },
  headerAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  headerAvatarText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  expandedSearchRow: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 8,
  },
  expandedSearchInputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 0,
    height: 38,
  },
  searchCloseBtn: {
    padding: 6,
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSearchInput: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
    padding: 0,
    paddingVertical: 0,
    paddingTop: 0,
    paddingBottom: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: RADIUS.full,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    gap: 6,
  },
  activeFilterText: {
    fontFamily: FONTS.displayBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  listContent: {
    paddingTop: 4,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    backgroundColor: 'transparent',
    alignSelf: 'center',
    maxWidth: 420,
    width: '100%',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    color: COLORS.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  emptyCtaText: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    color: '#ffffff',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: RADIUS.full,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 99,
  },
  fabText: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
