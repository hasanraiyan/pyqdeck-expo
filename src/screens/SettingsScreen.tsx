import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import * as WebBrowser from 'expo-web-browser';
import { Share } from 'react-native';
import Constants from 'expo-constants';
import { useAuth, useUser } from '@clerk/expo';
import { COLORS, FONTS } from '../theme/colors';
import { SettingsRow } from '../components/SettingsRow';
import { rf, verticalScale, useResponsive } from '../utils/responsive';
import {
  getVolumeScrollEnabled,
  setVolumeScrollEnabled,
  getOldUiEnabled,
  setOldUiEnabled,
} from '../utils/settings';
import { openStoreListing, checkForUpdateInteractive } from '../utils/appUpdate';
import * as Cache from '../db/cacheService';
import { isAuthEnabled } from '../config/features';

const WEBSITE_URL = 'https://pyqdeck.in';

const browserOptions = {
  toolbarColor: COLORS.card,
  controlsColor: COLORS.primary,
  secondaryToolbarColor: COLORS.background,
  showTitle: true,
  enableBarCollapsing: true,
};

export const SettingsScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const { readMaxWidth, hPadding } = useResponsive();
  const { isLoaded: authLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  const [volumeScrollOn, setVolumeScrollOn] = useState(true);
  const [oldUiOn, setOldUiOn] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    getOldUiEnabled().then(setOldUiOn);
    if (Platform.OS === 'android') {
      getVolumeScrollEnabled().then(setVolumeScrollOn);
    }
  }, []);

  const toggleOldUi = async (value: boolean) => {
    if (value === oldUiOn) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    setOldUiOn(value);
    await setOldUiEnabled(value);
  };

  const toggleVolumeScroll = async (value: boolean) => {
    setVolumeScrollOn(value);
    await setVolumeScrollEnabled(value);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear cached data?',
      'Downloaded subjects, questions, and solutions will be removed. They’ll re-download automatically as you browse.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            await Cache.clearAllCache();
            setClearing(false);
            setCleared(true);
            setTimeout(() => setCleared(false), 2000);
          },
        },
      ]
    );
  };

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    const result = await checkForUpdateInteractive();
    setCheckingUpdate(false);

    switch (result.status) {
      case 'update-started':
        Alert.alert('Update downloading', 'The update is downloading in the background - you\'ll be prompted to restart once it\'s ready.');
        break;
      case 'no-update':
        Alert.alert('Up to date', 'You\'re already using the latest version.');
        break;
      case 'unsupported':
        // No native in-app-update path available (iOS, web, or an old
        // build) - fall back to the Play Store listing, same as before.
        await openStoreListing();
        break;
      case 'failed':
        Alert.alert('Couldn\'t check for updates', 'Please try again later.');
        break;
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can keep using everything except Ask AI while signed out.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const handleRate = async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
        return;
      }
    } catch {}
    await openStoreListing();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `PyQdeck — BEU previous year question papers, free and searchable.\n${WEBSITE_URL}`,
      });
    } catch {}
  };

  const openWeb = async (path: string) => {
    try {
      await WebBrowser.openBrowserAsync(`${WEBSITE_URL}${path}`, browserOptions);
    } catch {}
  };

  const version = Constants.expoConfig?.version;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: insets.bottom + 24, paddingHorizontal: hPadding },
      ]}
    >
      <View style={[styles.centerWrapper, { maxWidth: readMaxWidth }]}>
        {isAuthEnabled && authLoaded && (
          <>
            <Text style={styles.sectionHeading}>ACCOUNT</Text>
            <View style={styles.card}>
              {isSignedIn ? (
                <>
                  <SettingsRow
                    icon="user"
                    label={user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Signed in'}
                    subtitle={
                      user?.fullName
                        ? user?.primaryEmailAddress?.emailAddress
                        : 'Manage your account'
                    }
                    onPress={() => navigation.navigate('ManageAccount')}
                  />
                  <SettingsRow icon="log-out" label="Sign out" onPress={handleSignOut} last />
                </>
              ) : (
                <SettingsRow
                  icon="log-in"
                  label="Sign in"
                  onPress={() => navigation.navigate('SignIn')}
                  last
                />
              )}
            </View>
          </>
        )}

        <Text style={styles.sectionHeading}>QUESTION READING LAYOUT</Text>
        <View style={styles.modeContainer}>
          {/* Accordion Mode Card */}
          <TouchableOpacity
            style={[styles.modeCard, !oldUiOn && styles.modeCardActive]}
            activeOpacity={0.75}
            onPress={() => toggleOldUi(false)}
          >
            <View style={styles.modeCardHeader}>
              <View style={[styles.modeIconBox, !oldUiOn && styles.modeIconBoxActive]}>
                <Feather
                  name="list"
                  size={15}
                  color={!oldUiOn ? COLORS.primary : COLORS.textMuted}
                />
              </View>
              <View style={[styles.radioCircle, !oldUiOn && styles.radioCircleActive]}>
                {!oldUiOn && <View style={styles.radioDot} />}
              </View>
            </View>
            <Text style={[styles.modeTitle, !oldUiOn && styles.modeTitleActive]}>
              Accordion
            </Text>
            <Text style={styles.modeSubtitle}>
              Tap to expand and view questions
            </Text>
          </TouchableOpacity>

          {/* Card Mode Card */}
          <TouchableOpacity
            style={[styles.modeCard, oldUiOn && styles.modeCardActive]}
            activeOpacity={0.75}
            onPress={() => toggleOldUi(true)}
          >
            <View style={styles.modeCardHeader}>
              <View style={[styles.modeIconBox, oldUiOn && styles.modeIconBoxActive]}>
                <Feather
                  name="layout"
                  size={15}
                  color={oldUiOn ? COLORS.primary : COLORS.textMuted}
                />
              </View>
              <View style={[styles.radioCircle, oldUiOn && styles.radioCircleActive]}>
                {oldUiOn && <View style={styles.radioDot} />}
              </View>
            </View>
            <Text style={[styles.modeTitle, oldUiOn && styles.modeTitleActive]}>
              Cards
            </Text>
            <Text style={styles.modeSubtitle}>
              Always show questions as open cards
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'android' && (
          <>
            <Text style={styles.sectionHeading}>CONTROLS</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="volume-2"
                label="Scroll with volume buttons"
                subtitle="Move between questions with hardware volume keys"
                last
                right={
                  <Switch
                    value={volumeScrollOn}
                    onValueChange={toggleVolumeScroll}
                    trackColor={{ true: COLORS.primary, false: COLORS.border }}
                    thumbColor={COLORS.card}
                  />
                }
              />
            </View>
          </>
        )}

        <Text style={styles.sectionHeading}>DATA</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="trash-2"
            label="Clear cached data"
            subtitle="Frees up space; content re-downloads as needed"
            onPress={clearing || cleared ? undefined : handleClearCache}
            last
            right={
              cleared ? (
                <Text style={styles.statusText}>Cleared</Text>
              ) : clearing ? (
                <Text style={styles.statusText}>Clearing…</Text>
              ) : undefined
            }
          />
        </View>

        <Text style={styles.sectionHeading}>SUPPORT PYQDECK</Text>
        <View style={styles.card}>
          <SettingsRow icon="star" label="Rate PyQdeck" subtitle="Enjoying the app? Leave a rating" onPress={handleRate} />
          <SettingsRow icon="share-2" label="Share PyQdeck" subtitle="Tell a friend about PyQdeck" onPress={handleShare} last />
        </View>

        <Text style={styles.sectionHeading}>ABOUT</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="refresh-cw"
            label="Check for updates"
            onPress={checkingUpdate ? undefined : handleCheckForUpdates}
            right={checkingUpdate ? <Text style={styles.statusText}>Checking…</Text> : undefined}
          />
          <SettingsRow icon="globe" label="Website" onPress={() => openWeb('/')} />
          <SettingsRow icon="shield" label="Privacy Policy" onPress={() => openWeb('/privacy')} />
          <SettingsRow icon="info" label="About PyQdeck" onPress={() => openWeb('/about')} last />
        </View>

        {version ? <Text style={styles.versionText}>PyQdeck v{version}</Text> : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingTop: verticalScale(16),
  },
  centerWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeading: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    fontWeight: '700',
    color: COLORS.textSubtle,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11.5),
    fontWeight: '600',
    color: COLORS.primary,
  },
  versionText: {
    fontFamily: FONTS.mono,
    fontSize: rf(11),
    color: COLORS.textSubtle,
    textAlign: 'center',
    marginTop: 24,
  },
  modeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  modeCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 13,
  },
  modeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#ffffff',
  },
  modeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modeIconBox: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: COLORS.cardSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  modeIconBoxActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryBorder,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primary,
  },
  modeTitle: {
    fontFamily: FONTS.serif,
    fontSize: rf(13.5),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modeTitleActive: {
    color: COLORS.primary,
  },
  modeSubtitle: {
    fontSize: rf(10.5),
    color: COLORS.textMuted,
    lineHeight: rf(14.5),
  },
});
