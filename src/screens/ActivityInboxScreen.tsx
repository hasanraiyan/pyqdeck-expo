import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS } from '../theme/colors';
import { ScreenContainer } from '../components/ScreenContainer';
import { rf } from '../utils/responsive';
import { SwipeableDismissItem } from '../components/SwipeableDismissItem';

export interface UnifiedNotificationItem {
  id: string;
  type: 'message' | 'comment' | 'upvote' | 'system' | 'follow';
  title: string;
  body: string;
  time: string;
  read: boolean;
  avatarLetter?: string;
  senderName?: string;
  senderCollege?: string;
  userId?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
}

const MOCK_NOTIFICATIONS: UnifiedNotificationItem[] = [
  {
    id: 'msg-1',
    type: 'message',
    title: 'Aarav Sharma sent you a message',
    body: 'Hey, do you have Module 4 handwritten notes for OS?',
    time: '10m ago',
    read: false,
    senderName: 'Aarav Sharma',
    senderCollege: 'BEU Tech Campus',
    userId: 'user-1',
    avatarLetter: 'A',
    icon: 'message-circle',
    iconColor: COLORS.primary,
  },
  {
    id: 'notif-1',
    type: 'comment',
    title: 'Aarav Sharma commented on your post',
    body: 'The step 3 calculation in Banker\'s Algo trace is really clear now. Thanks!',
    time: '25m ago',
    read: false,
    icon: 'message-square',
    iconColor: '#0284c7',
  },
  {
    id: 'notif-2',
    type: 'upvote',
    title: 'New Upvotes on your post',
    body: 'Your post "CN Module 3 Transport Layer" received 14 new upvotes.',
    time: '2h ago',
    read: false,
    icon: 'arrow-up',
    iconColor: '#16a34a',
  },
  {
    id: 'msg-2',
    type: 'message',
    title: 'Priya Patel sent you a message',
    body: 'Check the 2023 paper solution I just uploaded to Community.',
    time: '3h ago',
    read: true,
    senderName: 'Priya Patel',
    senderCollege: 'GEC Patna',
    userId: 'user-2',
    avatarLetter: 'P',
    icon: 'message-circle',
    iconColor: COLORS.primary,
  },
  {
    id: 'notif-3',
    type: 'system',
    title: 'BEU Exam Notice',
    body: 'B.Tech 6th Semester examination routine released on university portal.',
    time: '5h ago',
    read: true,
    icon: 'bell',
    iconColor: '#f59e0b',
  },
  {
    id: 'notif-4',
    type: 'follow',
    title: 'Priya Patel followed you',
    body: 'ECE 6th Sem • GEC Patna • Top Contributor',
    time: '1d ago',
    read: true,
    icon: 'user-plus',
    iconColor: '#8b5cf6',
    userId: 'user-2',
  },
  {
    id: 'msg-3',
    type: 'message',
    title: 'Vikram Singh sent you a message',
    body: 'Thanks for clarifying the B+ Tree split logic!',
    time: 'Yesterday',
    read: true,
    senderName: 'Vikram Singh',
    senderCollege: 'MIT Muzaffarpur',
    userId: 'user-3',
    avatarLetter: 'V',
    icon: 'message-circle',
    iconColor: COLORS.primary,
  },
];

type FilterType = 'all' | 'unread' | 'messages' | 'activity';

export const ActivityInboxScreen: React.FC<{ route?: any }> = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<UnifiedNotificationItem[]>(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = items.filter((n) => !n.read).length;

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  };

  const markAllRead = () => {
    Haptics.selectionAsync().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const onItemPress = (item: UnifiedNotificationItem) => {
    Haptics.selectionAsync().catch(() => {});
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.userId) {
      navigation.navigate('UserProfile', { userId: item.userId });
    }
  };

  const onDismissItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'messages') return item.type === 'message';
    if (filter === 'activity') return item.type !== 'message';
    return true;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Unified Header */}
      <View style={styles.siteHeader}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeftRow}>
            {navigation.canGoBack() && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  navigation.goBack();
                }}
                style={styles.backBtn}
                hitSlop={8}
                accessibilityLabel="Go back"
              >
                <Feather name="arrow-left" size={20} color={COLORS.text} />
              </TouchableOpacity>
            )}
            <View style={styles.brandRow}>
              <Text style={styles.brandTitle}>Notifications</Text>
              <Text style={styles.brandSubtitle}>UPDATES & MESSAGES</Text>
            </View>
          </View>

          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              style={styles.markReadBtn}
              hitSlop={8}
            >
              <Text style={styles.markReadText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'unread', label: `Unread (${unreadCount})` },
              { key: 'messages', label: 'Messages' },
              { key: 'activity', label: 'Activity' },
            ] as const
          ).map((chip) => {
            const isActive = filter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFilter(chip.key);
                }}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Unified List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        <ScreenContainer variant="read" gutter={false}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Feather name="bell-off" size={26} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'unread'
                  ? 'No unread notifications or messages.'
                  : 'You have no notifications right now.'}
              </Text>
            </View>
          ) : (
            <View style={styles.listSection}>
              {filteredItems.map((item) => {
                const isMsg = item.type === 'message';
                return (
                  <SwipeableDismissItem
                    key={item.id}
                    onDismiss={() => onDismissItem(item.id)}
                  >
                    <TouchableOpacity
                      style={[styles.itemCard, !item.read && styles.itemCardUnread]}
                      activeOpacity={0.7}
                      onPress={() => onItemPress(item)}
                    >
                      {isMsg ? (
                        <View style={styles.avatarWrap}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {item.avatarLetter || item.senderName?.[0] || 'U'}
                            </Text>
                          </View>
                          <View style={styles.avatarBadge}>
                            <Feather name="message-circle" size={10} color="#ffffff" />
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.iconCircle,
                            {
                              backgroundColor: item.iconColor
                                ? `${item.iconColor}15`
                                : COLORS.primaryLight,
                            },
                          ]}
                        >
                          <Feather
                            name={item.icon || 'bell'}
                            size={18}
                            color={item.iconColor || COLORS.primary}
                          />
                        </View>
                      )}

                      <View style={styles.cardContent}>
                        <View style={styles.topRow}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.itemTime}>{item.time}</Text>
                        </View>

                        {isMsg && item.senderCollege ? (
                          <Text style={styles.collegeSubtext} numberOfLines={1}>
                            {item.senderCollege}
                          </Text>
                        ) : null}

                        <Text
                          style={[
                            styles.itemBody,
                            isMsg && styles.itemBodyMessage,
                          ]}
                          numberOfLines={2}
                        >
                          {item.body}
                        </Text>
                      </View>

                      {!item.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  </SwipeableDismissItem>
                );
              })}
            </View>
          )}
        </ScreenContainer>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  siteHeader: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'column',
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
  markReadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markReadText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 12,
    color: COLORS.primary,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#f3f4f6',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    fontFamily: FONTS.bodySemi,
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  listSection: {
    gap: 8,
    paddingHorizontal: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 13,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  itemCardUnread: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(31, 75, 67, 0.2)',
  },
  avatarText: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: COLORS.primary,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: COLORS.text,
    flex: 1,
    marginRight: 6,
  },
  itemTime: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  collegeSubtext: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  itemBody: {
    fontFamily: FONTS.body,
    fontSize: 12.5,
    color: '#4b5563',
    lineHeight: 18,
  },
  itemBodyMessage: {
    fontFamily: FONTS.bodyMedium,
    color: COLORS.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    flexShrink: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
