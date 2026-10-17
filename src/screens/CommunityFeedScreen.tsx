import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth, useUser } from '@clerk/expo';
import { isAuthEnabled } from '../config/features';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { CommunityPost } from '../types/community';
import { communityStore } from '../data/mockCommunity';
import { CommunityPostCard } from '../components/community/CommunityPostCard';
import { CreateCommunityPostModal } from '../components/community/CreateCommunityPostModal';
import { CommunityCommentsBottomSheet } from '../components/community/CommunityCommentsBottomSheet';
import { NewPostIcon } from '../components/community/NewPostIcon';
import { ScreenContainer } from '../components/ScreenContainer';
import { CommunityFeedSkeleton } from '../components/Skeletons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const CommunityFeedScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(
    route.params?.filterHashtag || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentSheetPost, setCommentSheetPost] = useState<CommunityPost | null>(null);

  // Initial load simulation with skeleton placeholder
  useEffect(() => {
    const timer = setTimeout(() => {
      setPosts(communityStore.getPosts());
      setIsLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  // Sync with store updates
  useEffect(() => {
    const unsub = communityStore.subscribe(() => {
      setPosts(communityStore.getPosts());
    });
    return unsub;
  }, []);

  // Sync route params if navigated with filter
  useEffect(() => {
    if (route.params?.filterHashtag) {
      setSelectedHashtag(route.params.filterHashtag);
    }
  }, [route.params?.filterHashtag]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setPosts(communityStore.getPosts());
      setRefreshing(false);
    }, 600);
  };

  // Filter posts based on hashtag and text search
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // 1. Hashtag filter
      if (selectedHashtag) {
        const matchesTag = post.hashtags.some(
          (h) => h.toLowerCase() === selectedHashtag.toLowerCase()
        ) || post.body.toLowerCase().includes(`#${selectedHashtag.toLowerCase()}`);
        if (!matchesTag) return false;
      }

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inBody = post.body.toLowerCase().includes(q);
        const inAuthor = post.author.name.toLowerCase().includes(q);
        const inTags = post.hashtags.some((h) => h.toLowerCase().includes(q));
        if (!inBody && !inAuthor && !inTags) return false;
      }

      return true;
    });
  }, [posts, selectedHashtag, searchQuery]);

  const handleOpenDetail = (post: CommunityPost, focusComments = false) => {
    navigation.navigate('CommunityPostDetail', {
      postId: post.id,
      initialPost: post,
      focusComments,
    });
  };

  const renderHeader = () => {
    if (!selectedHashtag) return null;
    return (
      <View style={styles.activeFilterRow}>
        <Text style={styles.activeFilterText}>Filtered by #{selectedHashtag}</Text>
        <TouchableOpacity
          onPress={() => setSelectedHashtag(null)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={13} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => (
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
        onPress={() => setCreateModalVisible(true)}
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
            <TouchableOpacity
              style={styles.searchBackBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsSearchExpanded(false);
                setSearchQuery('');
              }}
              hitSlop={8}
              accessibilityLabel="Close search"
            >
              <Feather name="arrow-left" size={20} color={COLORS.text} />
            </TouchableOpacity>

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
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                >
                  <Feather name="x" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
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
                style={styles.headerPostBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setCreateModalVisible(true);
                }}
                activeOpacity={0.7}
                hitSlop={8}
                accessibilityLabel="Create new post"
              >
                <NewPostIcon size={21} color={COLORS.primary} />
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
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScreenContainer variant="read" gutter={false}>
              <CommunityPostCard
                post={item}
                onLikePress={(id) => communityStore.toggleLikePost(id)}
                onBookmarkPress={(id) => communityStore.toggleBookmarkPost(id)}
                onHashtagPress={(tag) => setSelectedHashtag(tag)}
                onCommentPress={(p) => setCommentSheetPost(p)}
                onOpenDetail={(p) => handleOpenDetail(p, false)}
                onDismissPost={(id) => communityStore.dismissPost(id)}
              />
            </ScreenContainer>
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
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
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  siteHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    minWidth: 0,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    fontSize: 22,
    color: COLORS.text,
    letterSpacing: -0.6,
    lineHeight: 25,
  },
  brandSubtitle: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 9.5,
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
  headerPostBtn: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
  },
  searchBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSearchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardSecondary,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 34,
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
});
