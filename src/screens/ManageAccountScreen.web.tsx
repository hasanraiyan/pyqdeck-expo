import React, { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '@clerk/expo';
import { UserProfile } from '@clerk/expo/web';
import { COLORS } from '../theme/colors';

/** Web account management: Clerk's in-page <UserProfile />; the native view is iOS/Android only. */
export const ManageAccountScreen = ({ navigation }: any) => {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigation.goBack();
  }, [isLoaded, isSignedIn, navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <UserProfile routing="hash" />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { alignItems: 'center', padding: 16 },
});
