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
 * Signed out: a dismissible nudge under the Study header to sign in and back up
 * progress. Signed in: renders nothing - syncing happens silently in the background.
 */
export const SyncStatusBar = () => {
  const navigation = useNavigation<any>();
  const { isLoaded, isSignedIn } = useAuth();
  const [hintDismissed, setHintDismissed] = useState(true); // hidden until read

  useEffect(() => {
    AsyncStorage.getItem(HINT_DISMISSED_KEY)
      .then((v) => setHintDismissed(v === '1'))
      .catch(() => setHintDismissed(false));
  }, []);

  if (!isAuthEnabled || !isLoaded) return null;

  if (!isSignedIn) {
    if (hintDismissed) return null;
    return (
      <View style={styles.row}>
        <View style={styles.chip}>
          <TouchableOpacity
            style={styles.chipMain}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SignIn', { reason: 'vote' })}
          >
            <Feather name="cloud" size={13} color={COLORS.primary} />
            <Text style={styles.hintText}>Sign in to back up your progress</Text>
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
});
