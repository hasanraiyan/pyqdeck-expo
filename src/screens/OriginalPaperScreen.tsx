import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { OriginalPaperViewer } from '../components/OriginalPaperViewer';
import { paperPagesQuery } from '../api/queries';
import { recordContentOpenedAndMaybeShowInterstitial } from '../utils/ads';
import { getPlaceholderPaper } from '../utils/originalPaperPlaceholder';
import { COLORS, FONTS } from '../theme/colors';
import { userMessage } from '../utils/netError';

/**
 * Paper-level viewer route for one year's original scanned paper
 * (docs/SRS-original-paper-viewer.md).
 *
 * Registered with `headerShown: false`: the route pushes like any other
 * screen (back gesture, no tab bar on deep screens) but shows no navigation
 * header - the viewer's own top bar (back, title, page counter) is its only
 * chrome.
 *
 * Data: signed server pages per account. Dev fallback is the placeholder
 * sample so the UI stays demonstrable without uploaded originals; release
 * builds never see it (the button itself is dev-gated until `hasOriginal`).
 */
export const OriginalPaperScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { subjectId, year } = route.params ?? {};

  // A viewer open counts like any other content open: the shared interstitial
  // budget (every 4th open, 2-minute cooldown) decides whether one shows.
  useEffect(() => {
    void recordContentOpenedAndMaybeShowInterstitial();
  }, []);

  const pagesQ = useQuery({
    ...paperPagesQuery(String(subjectId ?? ''), Number(year ?? 0), !!isSignedIn),
    enabled: !!subjectId && year != null,
  });

  const serverPages = pagesQ.data?.pages ?? [];
  // Dev only: stay demonstrable with the sample when nothing is uploaded (or
  // the fetch fails). Release builds get real pages or an error state.
  const pages =
    serverPages.length > 0
      ? serverPages
      : __DEV__
        ? getPlaceholderPaper(String(subjectId ?? ''), Number(year ?? 0)).map((p) => ({
            order: p.index,
            width: null,
            height: null,
            url: p.url,
          }))
        : [];

  if (pages.length === 0) {
    const loading = pagesQ.isPending;
    return (
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </TouchableOpacity>
        {loading ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : (
          <>
            <Feather name="file-text" size={28} color={COLORS.textSubtle} />
            <Text style={styles.message}>
              {userMessage(pagesQ.error, 'Could not load this paper.')}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              activeOpacity={0.7}
              onPress={() => void pagesQ.refetch()}
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <OriginalPaperViewer
      year={Number(year ?? 0)}
      pages={pages}
      onClose={() => navigation.goBack()}
    />
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginTop: 4,
  },
  retryText: { fontFamily: FONTS.displayBold, fontSize: 13.5, color: '#fff' },
});
