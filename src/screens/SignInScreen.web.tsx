import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth } from '@clerk/expo';
import { SignIn } from '@clerk/expo/web';
import { COLORS } from '../theme/colors';
import { rf } from '../utils/responsive';

/**
 * Web sign-in. The native AuthView only exists on iOS and Android (on web it
 * renders a "only available on iOS and Android" notice), so the browser gets
 * Clerk's hosted-in-page <SignIn /> instead. It shows whatever the dashboard
 * has enabled, same as the native sheet.
 *
 * `routing="hash"` keeps the flow inside this React Navigation route: the
 * component keeps its steps in the URL hash, not in paths the router knows nothing about.
 * OAuth (Google / GitHub) leaves the page and returns to the app root, where
 * the session is already restored, so the isSignedIn effect only has to close
 * the sheet for the email-code path.
 */
export const SignInScreen = ({ navigation, route }: any) => {
  const { isLoaded, isSignedIn } = useAuth();
  const reason = route?.params?.reason;

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Tabs');
    }
  }, [isLoaded, isSignedIn, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {reason ? (
        <Text style={styles.notice}>Sign in to continue.</Text>
      ) : null}
      <View style={styles.card}>
        <SignIn routing="hash" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { alignItems: 'center', padding: 20 },
  notice: { fontSize: rf(14), color: COLORS.textMuted, marginBottom: 12 },
  card: { alignItems: 'center' },
});
