import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme/colors';
import { openStoreListing } from '../utils/appUpdate';
import { useAppConfig } from '../config/useAppConfig';
import { getCurrentAppVersion } from '../config/appConfig';
import { updateStatus } from '../config/appConfigLogic';

/**
 * Covers the app when the running version is below the admin's minimum. It is
 * rendered on top of everything (the navigation underneath keeps its state) and
 * disappears by itself if the requirement is lifted. Offline, the last stored
 * config still applies.
 */
export const UpdateRequiredScreen = () => {
  const config = useAppConfig();
  if (updateStatus(config, getCurrentAppVersion()) !== 'required') return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.iconWrap}>
        <Feather name="download-cloud" size={34} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>Update required</Text>
      <Text style={styles.body}>
        This version of PyQdeck is no longer supported. Please update to version{' '}
        {config.minAppVersion} or newer to keep using the app.
      </Text>
      <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={() => void openStoreListing()}>
        <Text style={styles.buttonText}>Update now</Text>
      </TouchableOpacity>
      <Text style={styles.small}>Installed: {getCurrentAppVersion()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  title: { fontFamily: FONTS.displayBold, fontSize: 22, color: COLORS.text, marginBottom: 10 },
  body: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
  },
  buttonText: { fontFamily: FONTS.bodySemi, fontSize: 15, color: '#fff' },
  small: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSubtle, marginTop: 16 },
});
