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
  // Why the sheet opened, so the heading names the thing the user just tried
  // to do. Anything else (Settings -> Sign in) gets no heading at all.
  const reason = route?.params?.reason;
  const heading =
    reason === 'vote'
      ? 'Sign in to vote'
      : reason === 'report'
        ? 'Sign in to report a solution'
        : reason === 'ai'
          ? 'Sign in to use Ask AI'
          : null;

  // AuthView has no onSuccess callback - the documented pattern is to watch
  // auth state and close once the session lands.
  useEffect(() => {
    if (isLoaded && isSignedIn) navigation.goBack();
  }, [isLoaded, isSignedIn, navigation]);

  return (
    // No React Navigation header on this route, so the status-bar inset has to
    // be paid here or the heading sits underneath the clock. AuthView fills the
    // rest and brings its own close button, which is the only dismiss control.
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {heading && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{heading}</Text>
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
  },
});
