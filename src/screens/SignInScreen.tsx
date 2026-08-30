import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { AuthView } from '@clerk/expo/native';
import { COLORS } from '../theme/colors';
import { rf } from '../utils/responsive';

/**
 * Sign-in sheet. Reached only from Settings or from an AI entry point - no
 * other screen in the app routes here, because nothing else requires an
 * account.
 *
 * Uses Clerk's native AuthView rather than a hand-rolled form: the pyqdeck
 * Clerk instance has Google, GitHub, email-code and passkeys all enabled
 * (and is passwordless - `password.used_for_first_factor` is false), so a
 * custom flow would mean maintaining four strategies plus the smart-captcha
 * mount point. AuthView renders whatever the dashboard has enabled and syncs
 * the session to the JS client itself, so there is no setActive() call here.
 *
 * Native component => needs a dev build (`pnpm android`), not Expo Go.
 */
export const SignInScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const reason = route?.params?.reason;

  // AuthView has no onSuccess callback - the documented pattern is to watch
  // auth state and close once the session lands.
  useEffect(() => {
    if (isLoaded && isSignedIn) navigation.goBack();
  }, [isLoaded, isSignedIn, navigation]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {reason === 'ai' && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Sign in to use Ask AI</Text>
          <Text style={styles.noticeBody}>
            Papers, solutions, syllabus and search stay free without an account. Only the AI
            tutor needs one, so we can keep it running.
          </Text>
        </View>
      )}
      <AuthView
        mode="signInOrUp"
        isDismissible
        onDismiss={() => navigation.goBack()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  notice: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  noticeTitle: {
    fontSize: rf(16),
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: rf(13),
    lineHeight: rf(19),
    color: COLORS.textMuted,
  },
});
