import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuth } from '@clerk/expo';
import { UserProfileView } from '@clerk/expo/native';
import { COLORS } from '../theme/colors';

/**
 * Clerk's native account-management surface: avatar, email addresses,
 * passkeys, connected accounts, security and account deletion. All of it is
 * maintained by Clerk, so there is nothing to hand-roll or keep in sync with
 * whatever the dashboard has enabled.
 *
 * The route's own header is hidden and onHostBack is passed instead, which is
 * the documented pattern for embedding this in a host navigator: the
 * component keeps its own titles, back button and transitions, so the inner
 * screens feel native rather than fighting a React Navigation header.
 *
 * UserProfileView also owns sign-out and syncs it to the JS SDK by itself, so
 * signing out from in here has to pop the route - hence the isSignedIn watch.
 */
export const ManageAccountScreen = ({ navigation }: any) => {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    // Signing out (or deleting the account) from inside the native view leaves
    // this route showing a profile for nobody, so leave with it.
    if (isLoaded && !isSignedIn) navigation.goBack();
  }, [isLoaded, isSignedIn, navigation]);

  return (
    <View style={styles.container}>
      <UserProfileView
        style={styles.profile}
        isDismissible={false}
        onHostBack={() => navigation.goBack()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profile: { flex: 1 },
});
