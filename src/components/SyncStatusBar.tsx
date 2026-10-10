import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/expo';
import { COLORS, FONTS } from '../theme/colors';
import { isAuthEnabled } from '../config/features';
import { getSyncStatus, isSyncEnabled, subscribeSyncStatus, type SyncStatus } from '../db/progressSync';

const HINT_DISMISSED_KEY = 'pyqdeck:sync_hint_dismissed';

/**
 * One quiet line under the Study header. Signed in: whether progress is saved
 * to the account. Signed out: a dismissible nudge to sign in and back it up.
 * Fixed height, so it never shifts the layout when its text changes.
 */
export const SyncStatusBar = () => {
  const navigation = useNavigation<any>();
  const { isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [hintDismissed, setHintDismissed] = useState(true); // hidden until read

  useEffect(() => subscribeSyncStatus(setStatus), []);
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
        <TouchableOpacity
          style={styles.hint}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('SignIn', { reason: 'vote' })}
        >
          <Feather name="cloud" size={13} color={COLORS.primary} />
          <Text style={styles.hintText}>Sign in to back up your progress</Text>
        </TouchableOpacity>
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss"
          onPress={() => {
            setHintDismissed(true);
            AsyncStorage.setItem(HINT_DISMISSED_KEY, '1').catch(() => {});
          }}
        >
          <Feather name="x" size={14} color={COLORS.textSubtle} />
        </TouchableOpacity>
      </View>
    );
  }

  if (!isSyncEnabled()) return null;

  const { state, pending } = status;
  let icon: React.ComponentProps<typeof Feather>['name'] = 'check-circle';
  let text = 'Progress saved to your account';
  if (state === 'syncing') {
    icon = 'refresh-cw';
    text = 'Syncing...';
  } else if (state === 'offline' || (state === 'error' && pending > 0)) {
    icon = 'cloud-off';
    text = pending > 0 ? `Offline - ${pending} waiting to sync` : 'Offline';
  } else if (state === 'paused') {
    icon = 'alert-circle';
    text = 'Sync paused - sign in again';
  } else if (pending > 0) {
    icon = 'upload-cloud';
    text = `${pending} waiting to sync`;
  }

  return (
    <View style={styles.row}>
      <View style={styles.hint}>
        <Feather name={icon} size={13} color={COLORS.textMuted} />
        <Text style={styles.statusText}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.primary },
  statusText: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.textMuted },
});
