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
 */
export const AppBanner = () => {
  const { banner } = useAppConfig();
  const [dismissed, setDismissed] = useState(true); // hidden until the stored id is read

  useEffect(() => {
    let alive = true;
    setDismissed(true);
    void isBannerDismissed(banner.id).then((d) => alive && setDismissed(d));
    return () => {
      alive = false;
    };
  }, [banner.id]);

  if (!banner.message || dismissed) return null;
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
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Dismiss"
        onPress={() => {
          setDismissed(true);
          void dismissBanner(banner.id);
        }}
      >
        <Feather name="x" size={15} color={warning ? '#92400e' : COLORS.textSubtle} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  warning: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  text: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.text },
  warningText: { color: '#78350f' },
});
