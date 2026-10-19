import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { AuthView } from '@clerk/expo/native';
import { COLORS } from '../theme/colors';
import { rf } from '../utils/responsive';

/**
 * Sign-in sheet. Reached from Settings, from an AI entry point, from a vote /
 * report gate, or from the Study tab's persistent "Log in to save your
 * progress" card - no other screen in the app routes here, because nothing
 * else requires an account.
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
  // 'signUp' opens on account creation, 'signIn' on sign-in; by default one screen offers both.
  const mode: 'signIn' | 'signUp' | 'signInOrUp' = route?.params?.mode ?? 'signInOrUp';
  const heading =
    reason === 'vote'
      ? 'Sign in to vote'
      : reason === 'report'
        ? 'Sign in to report a solution'
        : reason === 'ai'
          ? 'Sign in to use Ask AI'
          : reason === 'progress'
            ? 'Log in to save your progress'
            : reason === 'paper'
              ? 'Sign in to view the original paper'
              : reason === 'post'
                ? 'Sign in to post'
                : reason === 'comment'
                  ? 'Sign in to comment'
                  : reason === 'react'
                    ? 'Sign in to like and save posts'
                    : reason === 'follow'
                      ? 'Sign in to follow students'
                      : reason === 'flag'
                        ? 'Sign in to report this'
                        : reason === 'community'
                          ? 'Sign in to join the community'
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
          <Text style={styles.noticeHint}>
            New to PYQDeck? Continue with Google, GitHub or your email and your account is created in a few seconds.
          </Text>
        </View>
      )}
      <AuthView
        mode={mode}
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
  noticeHint: {
    marginTop: 4,
    fontSize: rf(13),
    color: COLORS.textMuted,
  },
  noticeTitle: {
    fontSize: rf(16),
    fontWeight: '600',
    color: COLORS.text,
  },
});
