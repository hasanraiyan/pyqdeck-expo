import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
 * `dismissible={false}` (used by the Study tab) renders a wider "Log in to save
 * your progress" card with both account buttons; it carries an X in the corner
 * and remembers the dismissal in AsyncStorage, same as the Home pill.
 */
export const SyncStatusBar = ({ dismissible = true }: { dismissible?: boolean } = {}) => {
  const navigation = useNavigation<any>();
  const { isLoaded, isSignedIn } = useAuth();
  // null while AsyncStorage is being read, so the card never flashes in and
  // then disappears for someone who dismissed it earlier.
  const [hintDismissed, setHintDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HINT_DISMISSED_KEY)
      .then((v) => setHintDismissed(v === '1'))
      .catch(() => setHintDismissed(false));
  }, []);

  const dismiss = () => {
    setHintDismissed(true);
    AsyncStorage.setItem(HINT_DISMISSED_KEY, '1').catch(() => {});
  };

  if (!isAuthEnabled || !isLoaded) return null;

  if (!isSignedIn) {
    if (hintDismissed !== false) return null;
    if (!dismissible) {
      return (
        <View style={styles.persistentCard}>
          <View style={styles.persistentHeader}>
            <Text style={styles.persistentTitle}>Log in to save your progress</Text>
            <TouchableOpacity
              style={styles.persistentClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              onPress={dismiss}
            >
              <Feather name="x" size={16} color={COLORS.textSubtle} />
            </TouchableOpacity>
          </View>
          <Text style={styles.persistentSub}>
            Your ticks stay on this device until you log in.
          </Text>
          <View style={styles.persistentActions}>
            <TouchableOpacity
              style={styles.persistentPrimary}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SignIn', { reason: 'progress' })}
              accessibilityRole="button"
              accessibilityLabel="Create account to save your progress"
            >
              <Text style={styles.persistentPrimaryText}>Create account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.persistentSecondary}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('SignIn', { reason: 'progress' })}
              accessibilityRole="button"
              accessibilityLabel="Log in to save your progress"
            >
              <Text style={styles.persistentSecondaryText}>Log in</Text>
            </TouchableOpacity>
          </View>
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
            onPress={dismiss}
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
  // Persistent Study-tab variant: same shape as the community "Join" card
  // (tinted surface, big title, body, pill buttons) plus a corner X.
  persistentCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  persistentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  persistentTitle: { flex: 1, fontFamily: FONTS.displayBold, fontSize: 16, color: COLORS.text },
  persistentClose: {
    marginTop: -2,
    marginRight: -4,
    padding: 4,
  },
  persistentSub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  persistentActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  persistentPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  persistentPrimaryText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: '#ffffff' },
  persistentSecondary: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  persistentSecondaryText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.primary },
});
