import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/expo';
import { COLORS, FONTS } from '../theme/colors';
import { isAuthEnabled } from '../config/features';

const HINT_DISMISSED_KEY = 'pyqdeck:sync_hint_dismissed';

/**
 * Signed out: a nudge under the Study header to sign in and back up
 * progress. Signed in: renders nothing - syncing happens silently in the background.
 *
 * `dismissible={false}` (used by the Study tab) renders a persistent,
 * non-dismissible "Log in to save your progress" card - no X button, no
 * AsyncStorage opt-out. The default `dismissible` pill keeps its old
 * dismiss behaviour for the Home slot.
 */
export const SyncStatusBar = ({ dismissible = true }: { dismissible?: boolean } = {}) => {
  const navigation = useNavigation<any>();
  const { isLoaded, isSignedIn } = useAuth();
  const [hintDismissed, setHintDismissed] = useState(true); // hidden until read

  useEffect(() => {
    if (!dismissible) return;
    AsyncStorage.getItem(HINT_DISMISSED_KEY)
      .then((v) => setHintDismissed(v === '1'))
      .catch(() => setHintDismissed(false));
  }, [dismissible]);

  if (!isAuthEnabled || !isLoaded) return null;

  if (!isSignedIn) {
    if (dismissible && hintDismissed) return null;
    if (!dismissible) {
      return (
        <View style={styles.persistentCard}>
          <View style={styles.persistentIcon}>
            <Feather name="cloud" size={16} color={COLORS.primary} />
          </View>
          <View style={styles.persistentCopy}>
            <Text style={styles.persistentTitle}>Log in to save your progress</Text>
            <Text style={styles.persistentSub}>
              Your ticks stay on this device until you log in.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.persistentBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SignIn', { reason: 'progress' })}
            accessibilityRole="button"
            accessibilityLabel="Log in to save your progress"
          >
            <Text style={styles.persistentBtnText}>Log in</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.row}>
        <View style={styles.chip}>
          <TouchableOpacity
            style={styles.chipMain}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SignIn', { reason: 'progress' })}
          >
            <Feather name="cloud" size={13} color={COLORS.primary} />
            <Text style={styles.hintText}>Log in to save your progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityLabel="Dismiss"
            onPress={() => {
              setHintDismissed(true);
              AsyncStorage.setItem(HINT_DISMISSED_KEY, '1').catch(() => {});
            }}
          >
            <Feather name="x" size={14} color={COLORS.textSubtle} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Signed in: syncing is silent. Nothing is shown while it saves in the
  // background; the Settings screen has the status for anyone who looks.
  return null;
};

const styles = StyleSheet.create({
  row: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  // The text and its dismiss button share one pill, so the x sits right beside
  // the label with even padding instead of drifting to the far screen edge.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  chipMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
  },
  dismiss: {
    paddingVertical: 8,
    paddingLeft: 6,
    paddingRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: COLORS.border,
  },
  hintText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.primary },
  // Persistent Study-tab variant: full-width card, no dismiss control.
  persistentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  persistentIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  persistentCopy: { flex: 1, minWidth: 0 },
  persistentTitle: { fontFamily: FONTS.bodyBold, fontSize: 13.5, color: COLORS.text },
  persistentSub: { fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 },
  persistentBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  persistentBtnText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: '#ffffff' },
});
