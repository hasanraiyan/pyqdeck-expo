import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, adsAvailable } from '../utils/mobileAds';
import { AD_UNIT_IDS } from '../config/ads';

// Temporary: surfaces ad load status directly in the UI instead of console
// logs. __DEV__ is false in release APK builds (like the ones this repo's
// GitHub Actions workflow produces), so console.warn never reaches anyone's
// device log. Flip this to false once ads are confirmed working on a real
// build - not meant to ship visible to real users.
const AD_DEBUG_UI = true;

// A single onAdFailedToLoad is often just transient no-fill, not a
// permanent problem - retry a few times before giving up. 30s is Google's
// own stated minimum refresh interval (ads.google.com/admob refresh
// guidance); retrying faster than that risks looking like refresh abuse.
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000;

type Status = 'unavailable' | 'loading' | 'loaded' | 'failed' | 'exhausted';

export const AdBanner: React.FC = () => {
  const [status, setStatus] = useState<Status>(adsAvailable && BannerAd ? 'loading' : 'unavailable');
  const attemptRef = useRef(0);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
    };
  }, []);

  const handleFailedToLoad = () => {
    if (attemptRef.current >= MAX_RETRIES) {
      setStatus('exhausted');
      return;
    }
    attemptRef.current += 1;
    setStatus('failed');
    retryTimeout.current = setTimeout(() => setStatus('loading'), RETRY_DELAY_MS * attemptRef.current);
  };

  if (status === 'unavailable') {
    return AD_DEBUG_UI ? <DebugBadge text="native ad module unavailable (adsAvailable=false)" /> : null;
  }

  if (status === 'failed') {
    return AD_DEBUG_UI ? (
      <DebugBadge
        text={`ad failed to load, retrying in ${(RETRY_DELAY_MS * attemptRef.current) / 1000}s (attempt ${attemptRef.current}/${MAX_RETRIES})`}
      />
    ) : null;
  }

  if (status === 'exhausted') {
    return AD_DEBUG_UI ? (
      <DebugBadge text={`ad failed to load after ${MAX_RETRIES} attempts (${AD_UNIT_IDS.banner})`} />
    ) : null;
  }

  // Unreachable in practice - status starts 'unavailable' (returned above)
  // whenever BannerAd is null - but TS can't infer that from component
  // state, so this satisfies the JSX type check below.
  if (!BannerAd) return null;

  return (
    <View style={styles.container}>
      {status === 'loading' && AD_DEBUG_UI && <DebugBadge text={`requesting ad (${AD_UNIT_IDS.banner})`} />}
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={handleFailedToLoad}
        onAdLoaded={() => {
          attemptRef.current = 0;
          setStatus('loaded');
        }}
      />
    </View>
  );
};

const DebugBadge: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.debugBox}>
    <Text style={styles.debugText}>AD DEBUG: {text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugBox: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  debugText: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
  },
});
