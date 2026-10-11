import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';
import { useAppConfig } from '../config/useAppConfig';
import { dismissBanner, isBannerDismissed } from '../config/appConfig';

/**
 * The admin's notice strip (maintenance, news). Dismissing it hides it until the
 * admin changes the banner's id, so a corrected typo does not bring it back but a
 * new announcement does.
 *
 * `fallback` takes the banner's place whenever there is nothing to show (no
 * banner set, or the student dismissed it) - Home uses it for the signed-out
 * "Sign in to back up your progress" nudge, so that slot is never empty space.
 */
export const AppBanner = ({ fallback = null }: { fallback?: React.ReactNode }) => {
  const { banner } = useAppConfig();
  // null until the stored dismissal is read, so the fallback does not flash in
  // for a moment before a real banner appears.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    setDismissed(null);
    if (!banner.message) return;
    void isBannerDismissed(banner.id).then((d) => alive && setDismissed(d));
    return () => {
      alive = false;
    };
  }, [banner.id, banner.message]);

  if (!banner.message) return <>{fallback}</>;
  if (dismissed === null) return null;
  if (dismissed) return <>{fallback}</>;
  const warning = banner.level === 'warning';

  return (
    <View style={[styles.strip, warning && styles.warning]}>
      <Feather
        name={warning ? 'alert-triangle' : 'info'}
        size={15}
        color={warning ? '#92400e' : COLORS.primary}
      />
      <Text style={[styles.text, warning && styles.warningText]}>{banner.message}</Text>
      <TouchableOpacity
        style={styles.close}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Dismiss"
        onPress={() => {
          setDismissed(true);
          void dismissBanner(banner.id);
        }}
      >
        <Feather name="x" size={16} color={warning ? '#92400e' : COLORS.textSubtle} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  close: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  warning: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  text: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
  warningText: { color: '#78350f' },
});
