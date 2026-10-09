import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  Modal,
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
import { rf, verticalScale } from '../utils/responsive';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  getVolumeScrollEnabled,
  setVolumeScrollEnabled,
  getOldUiEnabled,
  setOldUiEnabled,
} from '../utils/settings';
import { ASK_AI_ENGINES, AskAiEngineId, getAskAiEngine, setAskAiEngine } from '../utils/askAi';
import { openStoreListing, checkForUpdateInteractive } from '../utils/appUpdate';
import * as Cache from '../db/cacheService';
import { clearQueryCache } from '../api/queryClient';
import { isAuthEnabled, isAiEnabled } from '../config/features';
import { resetOnboarding } from '../utils/onboarding';

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
  const { isLoaded: authLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  const [volumeScrollOn, setVolumeScrollOn] = useState(true);
  const [oldUiOn, setOldUiOn] = useState(false);
  const [aiEngine, setAiEngine] = useState<AskAiEngineId>('coursify');
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    getOldUiEnabled().then(setOldUiOn);
    getAskAiEngine().then(setAiEngine);
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

  const chooseAiEngine = async (id: AskAiEngineId) => {
    if (id === aiEngine) return;
    try {
      await Haptics.selectionAsync();
    } catch {}
    setAiEngine(id);
    await setAskAiEngine(id);
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
            await clearQueryCache();
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

  const version = Constants.expoConfig?.version || '1.0.7';
  const versionCode = Constants.expoConfig?.android?.versionCode;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <ScreenContainer variant="read">
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

        {isAiEnabled && (
          <>
            <Text style={styles.sectionHeading}>ASK AI</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="message-circle"
                label="Ask AI opens in"
                last
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setAiMenuOpen(true);
                }}
                right={
                  <View style={styles.aiValue}>
                    <Text style={styles.aiValueText}>
                      {ASK_AI_ENGINES.find((e) => e.id === aiEngine)?.name ?? ''}
                    </Text>
                    <Feather name="chevron-right" size={16} color={COLORS.textSubtle} />
                  </View>
                }
              />
            </View>

            <Modal
              visible={aiMenuOpen}
              transparent
              animationType="slide"
              onRequestClose={() => setAiMenuOpen(false)}
            >
              <TouchableOpacity
                style={styles.sheetBackdrop}
                activeOpacity={1}
                onPress={() => setAiMenuOpen(false)}
              />
              <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Open Ask AI in</Text>
                {ASK_AI_ENGINES.map((engine) => {
                  const active = aiEngine === engine.id;
                  return (
                    <TouchableOpacity
                      key={engine.id}
                      style={styles.sheetRow}
                      activeOpacity={0.6}
                      onPress={() => {
                        chooseAiEngine(engine.id);
                        setAiMenuOpen(false);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={styles.sheetRowText}>
                        <Text style={[styles.sheetRowName, active && styles.sheetRowNameActive]}>
                          {engine.name}
                        </Text>
                        <Text style={styles.sheetRowHint}>{engine.hint}</Text>
                      </View>
                      <View style={[styles.radioCircle, active && styles.radioCircleActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Modal>
            <Text style={styles.aiNote}>
              Where Ask AI opens. Except Coursify, the question is also copied, so paste it if the box opens empty.
            </Text>
          </>
        )}

        {Platform.OS === 'android' && (
          <>
            <Text style={styles.sectionHeading}>CONTROLS</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="volume-2"
                label="Scroll with volume buttons"
                subtitle="Scroll questions and study notes with hardware volume keys"
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

        <Text style={styles.sectionHeading}>APP TOUR</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="compass"
            label="Replay Welcome Tour"
            subtitle="Reset and preview the 3-slide introduction again"
            onPress={async () => {
              try {
                await Haptics.selectionAsync();
              } catch {}
              await resetOnboarding();
              navigation.navigate('Onboarding');
            }}
            last
          />
        </View>

        {__DEV__ && (
          <>
            <Text style={styles.sectionHeading}>DEBUG</Text>
            <View style={styles.card}>
              <SettingsRow
                icon="git-merge"
                label="Diagram Preview"
                subtitle="Sample notes with rendered Mermaid state & architecture diagrams"
                onPress={() => {
                  try {
                    Haptics.selectionAsync();
                  } catch {}
                  navigation.navigate('MermaidDemo');
                }}
                last
              />
            </View>
          </>
        )}

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

        {version ? (
          <Text style={styles.versionText}>
            PyQdeck v{version}{versionCode ? ` (${versionCode})` : ''}
          </Text>
        ) : null}
      </ScreenContainer>
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
  aiValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aiValueText: { fontFamily: FONTS.displayBold, fontSize: rf(12.5), color: COLORS.primary },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(16),
    color: COLORS.text,
    marginBottom: 6,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  sheetRowText: { flex: 1, paddingRight: 12 },
  sheetRowName: { fontFamily: FONTS.bodyMedium, fontSize: rf(14.5), color: COLORS.text },
  sheetRowNameActive: { fontFamily: FONTS.displayBold, color: COLORS.primary },
  sheetRowHint: { fontFamily: FONTS.body, fontSize: rf(11.5), color: COLORS.textMuted, marginTop: 1 },
  aiNote: {
    fontFamily: FONTS.body,
    fontSize: rf(11.5),
    lineHeight: rf(16),
    color: COLORS.textMuted,
    marginTop: 6,
  },
  sectionHeading: {
    fontFamily: FONTS.displayBold,
    fontSize: rf(11),
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
    fontFamily: FONTS.displayBold,
    fontSize: rf(11.5),
    color: COLORS.primary,
  },
  versionText: {
    fontFamily: FONTS.bodyMedium,
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
    fontFamily: FONTS.displayBold,
    fontSize: rf(13.5),
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
