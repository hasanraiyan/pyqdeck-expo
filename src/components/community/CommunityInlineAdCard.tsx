import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BannerAd, BannerAdSize, adsAvailable } from '../../utils/mobileAds';
import { AD_UNIT_IDS } from '../../config/ads';
import { useResponsive } from '../../utils/responsive';
import { useAppConfig } from '../../config/useAppConfig';
import { useAdsEntitlement } from '../../utils/adsEntitlement';
import { COLORS, FONTS, RADIUS } from '../../theme/colors';

const bannerSizeFor = (isTablet: boolean) =>
  isTablet ? BannerAdSize.LEADERBOARD : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

export const CommunityInlineAdCard: React.FC = () => {
  const { isTablet } = useResponsive();
  const { flags } = useAppConfig();
  const entitlement = useAdsEntitlement();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const adsGatedOff = flags.adsEnabled === false || entitlement.adFree;

  if (adsGatedOff || failed) {
    return null;
  }

  // In Expo Go or environment without native Google Mobile Ads module, show dev placeholder
  if (!adsAvailable || !BannerAd) {
    if (!__DEV__) return null;
    return (
      <View style={styles.cardContainer}>
        <View style={styles.devAdBox}>
          <View style={styles.devAdIcon}>
            <Feather name="zap" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.devAdContent}>
            <Text style={styles.devAdTitle}>PyQdeck Exam Pro</Text>
            <Text style={styles.devAdDesc}>
              Complete previous year questions & verified answer keys for BEU exams.
            </Text>
          </View>
          <View style={styles.devAdCta}>
            <Text style={styles.devAdCtaText}>Explore</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cardContainer}>
      <View style={styles.adWrapper}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={bannerSizeFor(isTablet)}
          onAdLoaded={() => {
            setLoaded(true);
            setFailed(false);
          }}
          onAdFailedToLoad={() => {
            setFailed(true);
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  badgeText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: '#6b7280',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  devPillText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: '#9ca3af',
    letterSpacing: 0.3,
  },
  devAdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 16,
    padding: 12,
    gap: 12,
  },
  devAdIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  devAdContent: {
    flex: 1,
  },
  devAdTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 13.5,
    color: COLORS.text,
  },
  devAdDesc: {
    fontFamily: FONTS.body,
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  devAdCta: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  devAdCtaText: {
    fontFamily: FONTS.bodySemi,
    fontSize: 11,
    color: '#ffffff',
  },
  adWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
});
