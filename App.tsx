import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  getStateFromPath as defaultGetStateFromPath,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  useSafeAreaInsets,
  SafeAreaProvider,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { clerkPublishableKey } from './src/auth/publishableKey';
import { mobileAds } from './src/utils/mobileAds';
import { initInterstitial } from './src/utils/ads';
import { navigationRef } from './src/utils/navigationRef';
import { logScreenView } from './src/utils/analytics';
import * as Backend from './src/api/backend';
import { migrateToQueryCache } from './src/db/cacheService';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, persistOptions } from './src/api/queryClient';
import { BackendDebugBanner } from './src/components/BackendDebugBanner';
import {
  registerForPushNotificationsAsync,
  subscribeToNotificationResponses,
  handleColdStartNotification,
} from './src/utils/notifications';
import { COLORS, FONTS } from './src/theme/colors';
import { getShellWidth } from './src/theme/layout';
import { ShellTabBar } from './src/components/ShellTabBar';
import { getSidebarCollapsed, setSidebarCollapsed, getOldUiEnabled } from './src/utils/settings';
import { useResponsive } from './src/utils/responsive';
import { installWebStyles } from './src/utils/webStyles';
import { HomeScreen } from './src/screens/HomeScreen';
import { SubjectListScreen } from './src/screens/SubjectListScreen';
import { SubjectDetailScreen } from './src/screens/SubjectDetailScreen';
import { AllSubjectsScreen } from './src/screens/AllSubjectsScreen';
import { QuestionListScreen } from './src/screens/QuestionListScreen';
import { QuestionDetailScreen } from './src/screens/QuestionDetailScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { MermaidDemoScreen } from './src/screens/MermaidDemoScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { ManageAccountScreen } from './src/screens/ManageAccountScreen';
import { SemesterSelectScreen } from './src/screens/SemesterSelectScreen';
import { SyllabusOverviewScreen } from './src/screens/SyllabusOverviewScreen';
import { SubjectSyllabusScreen } from './src/screens/SubjectSyllabusScreen';
import { TopicNotesScreen } from './src/screens/TopicNotesScreen';
import { checkForStoreUpdate } from './src/utils/appUpdate';
import { maybeRequestReview } from './src/utils/appReview';
import { isSyllabusEnabled } from './src/config/features';
import * as Sentry from '@sentry/react-native';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { hasSeenOnboarding } from './src/utils/onboarding';
import { MermaidWorker } from './src/components/MermaidWorker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { bootWipeCheck, wipeUserData } from './src/auth/wipeUserData';
import { configureSyncSession, pendingCount } from './src/db/progressSync';
import { OWNER_KEY } from './src/db/storageRegistry';
import { isAuthEnabled } from './src/config/features';
import { linkPushTokenToAccount, subscribeToSyncNudges } from './src/utils/notifications';
import { requestSync } from './src/db/progressSync';
import { recordNudgeRun } from './src/background/diagnostics';
import {
  getAppConfigNow,
  loadCachedAppConfig,
  markRecommendedPromptShown,
  refreshAppConfig,
  shouldShowRecommendedPrompt,
} from './src/config/appConfig';
import { UpdateRequiredScreen } from './src/components/UpdateRequiredScreen';
import { openStoreListing } from './src/utils/appUpdate';

// Crash/error monitoring only - deliberately not sendDefaultPii (would send
// IP address etc, undisclosed in the Play Store Data Safety form) and no
// Session Replay (separate, bigger data-collection footprint that also
// isn't in that form and burns through the free tier's 50-replay/month cap
// fast). Matches this app's anonymous-by-default pattern everywhere else.
Sentry.init({
  dsn: 'https://a3710bead072e5656e354d44d062719c@o4511315369197568.ingest.us.sentry.io/4511965378314240',
  sendDefaultPii: false,
  enableLogs: true,
});

installWebStyles();

const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Mirrors pyqdeck-frontend's routes (see that repo's app/ directory) so a
// shared web link opens straight in the app whether it is installed or not:
//   /:semester/:subject/:year/:questionId          -> question (Browse tab)
//   /syllabus[?branch=]                            -> branch/semester picker
//   /syllabus/:branch/sem/:semester                -> semester sheet
//   /syllabus/subject/:slug                        -> subject modules/topics
//   /syllabus/subject/:slug/topic/:topicId/:topicSlug?  -> topic study notes
//   (topic URLs are hybrid, StackOverflow-style: the id resolves, the slug
//   tail is cosmetic for SEO/sharing and is ignored here)
//   /search?q=&tab=                                -> search with query + tab
// (see app.json's Android App Links intentFilters + the site's
// public/.well-known/assetlinks.json).
// Only the question shape has four segments; the year is always four digits.
// Any other 4-segment URL matches the question route by position alone, so it
// is rejected here and the app opens on Home instead of a broken screen.
const QUESTION_PATH = /^\/?[^/]+\/[^/]+\/\d{4}\/[^/]+\/?$/;

const linking: any = {
  prefixes: ['https://pyqdeck.in', 'https://www.pyqdeck.in'],
  getStateFromPath: (path: string, options: any) => {
    const pathname = path.split(/[?#]/)[0];
    const segments = pathname.split('/').filter(Boolean);
    const first = segments[0];
    if (first !== 'syllabus' && first !== 'search' && !QUESTION_PATH.test(pathname)) {
      return undefined;
    }
    return defaultGetStateFromPath(path, options);
  },
  config: {
    screens: {
      // Nested under Tabs now that a root stack sits above the tab navigator,
      // so the shipped Android App Links keep resolving.
      Tabs: {
        screens: {
          Browse: {
            screens: {
              QuestionDetail: ':semesterId/:subjectId/:year/:questionId',
            },
          },
          Syllabus: {
            screens: {
              SyllabusRoot: 'syllabus',
              SyllabusOverview: {
                path: 'syllabus/:branchId/sem/:semester',
                parse: { semester: (value: string) => Number(value) },
              },
              SubjectSyllabus: 'syllabus/subject/:subjectId',
              TopicNotes: 'syllabus/subject/:subjectId/topic/:topicId/:topicSlug?',
            },
          },
          Search: {
            screens: {
              SearchRoot: 'search',
            },
          },
        },
      },
    },
  },
};

const commonScreenOptions = {
  headerStyle: {
    backgroundColor: COLORS.background,
  },
  headerTintColor: COLORS.text,
  headerTitleStyle: {
    fontFamily: FONTS.displayBold,
  },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  contentStyle: {
    backgroundColor: COLORS.background,
  },
};

/** Screens reachable from more than one tab; each tab stack registers the same set. */
function renderSharedScreens(StackNav: typeof Stack, syllabusTitle = 'Syllabus') {
  return (
    <>
      <StackNav.Screen
        name="SubjectDetail"
        component={SubjectDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.subjectName || 'Subject',
        })}
      />
      <StackNav.Screen
        name="QuestionList"
        component={QuestionListScreen}
        options={({ route }: any) => ({
          title: route.params?.subjectName || 'Questions',
        })}
      />
      <StackNav.Screen
        name="QuestionDetail"
        component={QuestionDetailScreen}
        options={{
          title: 'Question Paper',
        }}
      />
      <StackNav.Screen
        name="TopicNotes"
        component={TopicNotesScreen}
        options={({ route }: any) => ({ title: route.params?.moduleName || 'Notes' })}
      />
      <StackNav.Screen
        name="SubjectSyllabus"
        component={SubjectSyllabusScreen}
        options={({ route }: any) => ({ title: route.params?.subjectName || syllabusTitle })}
      />
      <StackNav.Screen
        name="MermaidDemo"
        component={MermaidDemoScreen}
        options={{ title: 'Diagram Preview' }}
      />
    </>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={commonScreenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AllSubjects"
        component={AllSubjectsScreen}
        options={{ title: 'All Subjects' }}
      />
      <Stack.Screen
        name="SubjectList"
        component={SubjectListScreen}
        options={({ route }: any) => ({
          title: `Year ${route.params?.yearNumber || ''}`,
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      {renderSharedScreens(Stack)}
    </Stack.Navigator>
  );
}

/** Syllabus: unified branches + semesters root -> subjects -> topics */
function SyllabusStack() {
  return (
    <Stack.Navigator screenOptions={commonScreenOptions}>
      <Stack.Screen
        name="SyllabusRoot"
        component={SemesterSelectScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SyllabusOverview"
        component={SyllabusOverviewScreen}
        options={({ route }: any) => ({ title: `Semester ${route.params?.semester ?? ''}` })}
      />
      {renderSharedScreens(Stack, 'Subject')}
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={commonScreenOptions}>
      <Stack.Screen
        name="SearchRoot"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      {renderSharedScreens(Stack)}
    </Stack.Navigator>
  );
}

/** The tab navigator, wrapped by the root stack so the auth screens can sit above it. */
function TabsNavigator() {
  const insets = useSafeAreaInsets();
  const { shellMode } = useResponsive();
  const isBottom = shellMode === 'bottom';
  const isLaptopUp = shellMode === 'sidebar';
  // Collapsing only applies from laptop up; the choice is remembered (FR-N5).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    getSidebarCollapsed().then(setCollapsed);
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      setSidebarCollapsed(!c);
      return !c;
    });
  // A collapsed sidebar looks exactly like the tablet rail.
  const isSidebar = isLaptopUp && !collapsed;
  const shellWidth = getShellWidth(shellMode, collapsed);

  const ROOT_TAB_SCREENS = new Set(['Home', 'SyllabusRoot', 'SearchRoot']);

  const getTabStyleForRoute = (route: any) => {
    const routeName = getFocusedRouteNameFromRoute(route);
    // When routeName is undefined or one of the root screens, show the tab bar.
    // On all deeper pushed screens (which have a back button), hide the bottom tab bar.
    if (!routeName || ROOT_TAB_SCREENS.has(routeName)) {
      return undefined;
    }
    return { display: 'none' as const };
  };

  return (
    <Tab.Navigator
        tabBar={
          isBottom
            ? undefined
            : (props) => (
                <ShellTabBar
                  {...props}
                  width={shellWidth}
                  collapsible={isLaptopUp}
                  collapsed={collapsed}
                  onToggle={toggleCollapsed}
                />
              )
        }
        screenOptions={{
          headerShown: false,
          // Navigation follows window class (SRS section 4): bottom bar on
          // phone, 72 px icon rail on tablet, labelled sidebar from laptop up.
          // React Navigation turns the bar into a sidebar for 'left'.
          tabBarPosition: isBottom ? 'bottom' : 'left',
          tabBarVariant: isBottom ? 'uikit' : 'material',
          tabBarLabelPosition: isSidebar ? 'beside-icon' : 'below-icon',
          tabBarStyle: isBottom
            ? {
                backgroundColor: COLORS.card,
                borderTopColor: COLORS.border,
                borderTopWidth: 1,
                height: 56 + insets.bottom,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
                paddingTop: 6,
              }
            : {
                // ShellTabBar owns the column's width and border; the bar fills it.
                // React Navigation sizes a labelled sidebar by a fraction of the
                // window (its minWidth), so pin min and max to hold a fixed width.
                backgroundColor: 'transparent',
                borderRightWidth: 0,
                width: shellWidth,
                minWidth: shellWidth,
                maxWidth: shellWidth,
                // Default side padding would leave a 72 px rail ~48 px for its label.
                ...(isSidebar ? null : { paddingStart: 8, paddingEnd: 8 }),
              },
          // Rail labels sit under the icon, so keep them small enough not to clip.
          tabBarLabelStyle: isSidebar ? undefined : { fontSize: 10 },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
          // The bar has a fixed size; scaled labels would clip or push icons.
          tabBarAllowFontScaling: false,
        }}
      >
        <Tab.Screen
          name="Browse"
          component={HomeStack}
          options={({ route }: any) => ({
            tabBarLabel: 'PYQ',
            tabBarIcon: ({ color, size }) => (
              <Feather name="file-text" size={size} color={color} />
            ),
            tabBarStyle: getTabStyleForRoute(route),
          })}
        />
        {isSyllabusEnabled && (
          <Tab.Screen
            name="Syllabus"
            component={SyllabusStack}
            options={({ route }: any) => ({
              tabBarLabel: 'Study',
              tabBarIcon: ({ color, size }) => (
                <Feather name="book-open" size={size} color={color} />
              ),
              tabBarStyle: getTabStyleForRoute(route),
            })}
          />
        )}
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={({ route }: any) => ({
            tabBarLabel: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Feather name="search" size={size} color={color} />
            ),
            tabBarStyle: getTabStyleForRoute(route),
          })}
        />
    </Tab.Navigator>
  );
}


// Publishable key must be passed explicitly rather than read inside the SDK:
// env vars are not inlined inside node_modules in production builds. See
// src/auth/publishableKey.ts for why it falls back to app.json.
if (!clerkPublishableKey) {
  // Loud in dev, and Sentry catches it in production - but the app still
  // boots below, because everything except Ask AI works signed out.
  console.error(
    '[auth] No Clerk publishable key (checked EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ' +
      'and app.json expo.extra.clerkPublishableKey). Sign-in will be unavailable.'
  );
}

export default Sentry.wrap(function App() {
  return (
    // ClerkProvider renders its children straight away - it does not hold the
    // tree back while the token cache is read. That is deliberate and load
    // bearing: every screen except the AI tutor works signed out, so auth must
    // never sit on the critical path to first paint.
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SafeAreaProvider>
          <AppContent />
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </ClerkProvider>
  );
});

function AppContent() {
  const lastScreenRef = useRef<string | undefined>(undefined);
  const insets = useSafeAreaInsets();
  // null = still reading AsyncStorage (prevents white flash or wrong screen)
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // A failed load still counts as done: the hero falls back to the system font.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    void migrateToQueryCache();
    // Warm the saved question layout so the list opens in it on the first frame.
    void getOldUiEnabled();
  }, []);

  // Remote app config: use the stored copy straight away, refresh in the
  // background at launch and when the app returns to the foreground (throttled
  // to every 10 minutes). It never blocks startup.
  useEffect(() => {
    const maybePrompt = async () => {
      if (!(await shouldShowRecommendedPrompt())) return;
      await markRecommendedPromptShown();
      Alert.alert('Update available', 'A newer version of PyQdeck is available.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Update', onPress: () => void openStoreListing() },
      ]);
    };
    void loadCachedAppConfig()
      .then(() => refreshAppConfig())
      .then(maybePrompt);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAppConfig().then(maybePrompt);
    });
    return () => sub.remove();
  }, []);

  // An interrupted sign-out wipe is finished before anything reads user data:
  // onboarded stays null (nothing renders) until it is done.
  useEffect(() => {
    bootWipeCheck()
      .catch(() => {})
      .then(() => hasSeenOnboarding())
      .then((seen) => setOnboarded(seen));
  }, []);

  // Account state drives both halves of the feature. Signed in: hand the user
  // to the sync engine and link the push token. Signed out: wipe this device's
  // user data - whatever ended the session (Settings, Clerk's profile view,
  // account deletion, a revoked session), because this reacts to the state, not
  // to a button.
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const wasSignedInRef = useRef(false);
  useEffect(() => {
    if (!isAuthEnabled || !authLoaded) return;
    if (isSignedIn && userId) {
      wasSignedInRef.current = true;
      configureSyncSession({ signedIn: true, userId });
      void linkPushTokenToAccount();
      return;
    }
    configureSyncSession({ signedIn: false, userId: null });
    const justSignedOut = wasSignedInRef.current;
    wasSignedInRef.current = false;
    void (async () => {
      try {
        if (justSignedOut) return void (await wipeUserData('signed-out'));
        // Launch: the session ended while the app was closed. Only wipe if this
        // device still holds an account's data - but never when we are offline
        // with unsynced changes, since an offline cold start is the one case
        // where "signed out" may just mean Clerk could not reach its server.
        if (!(await AsyncStorage.getItem(OWNER_KEY))) return;
        const net = await Network.getNetworkStateAsync().catch(() => null);
        const offline = net ? net.isConnected === false || net.isInternetReachable === false : false;
        if (offline && (await pendingCount()) > 0) return;
        await wipeUserData('signed-out-at-launch');
      } catch {}
    })();
  }, [authLoaded, isSignedIn, userId]);

  // Silent boot work: shows nothing to the student, so it starts immediately.
  useEffect(() => {
    Promise.resolve(mobileAds().initialize())
      .then(initInterstitial)
      .catch(() => {});
    // A tap on a notification must never be missed, even mid-onboarding.
    const unsubscribe = subscribeToNotificationResponses();
    // Another device changed something: sync now (no-op when signed out).
    const unsubscribeNudges = subscribeToSyncNudges(() => {
      if (!getAppConfigNow().flags.nudgesEnabled) return; // admin switch
      void recordNudgeRun('foreground', 'received while the app was open, sync requested');
      requestSync({ immediate: true });
    });

    // Start backend selection alongside the rest of boot. It runs in the
    // background; requests do not wait for it (see src/api/backend.ts).
    void Backend.ready();

    // A session that fell back to Render should climb back onto EC2 once it
    // recovers. Returning to the foreground is the natural moment to look,
    // and recheckIfStale() ignores brief tab-aways.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') Backend.recheckIfStale();
    });

    return () => {
      unsubscribe();
      unsubscribeNudges();
      appStateSub.remove();
    };
  }, []);

  // Anything a student can SEE (OS permission prompt, store-update dialog,
  // review prompt) waits until onboarding is done, so a first-time user is
  // never interrupted before they have seen what the app does. Runs once:
  // `onboarded` only ever goes null -> boolean -> true.
  useEffect(() => {
    if (onboarded !== true) return;
    registerForPushNotificationsAsync();

    // Sequenced so a store-update prompt and a review prompt never show back to back.
    checkForStoreUpdate().finally(() => {
      maybeRequestReview();
    });
  }, [onboarded]);

  // Keyboard on web / desktop: Escape goes back (FR-N6) and "/" or Ctrl/Cmd+K
  // opens Search (FR-N8). Both are left alone while a dialog or an editable
  // field has focus, so they never fight typing or closing a modal.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || !!el?.isContentEditable;
      const dialogOpen = !!document.querySelector('[role="dialog"], [aria-modal="true"]');
      // Search shortcut (FR-N8): "/" or Ctrl/Cmd+K, never while typing.
      const isSearchKey = e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k');
      if (isSearchKey && !dialogOpen && (e.key !== '/' || !typing)) {
        if (!navigationRef.isReady()) return;
        e.preventDefault();
        navigationRef.navigate('Tabs', { screen: 'Search' });
        return;
      }
      if (e.key !== 'Escape' || typing || dialogOpen) return;
      if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Still reading AsyncStorage — render nothing to avoid a flash of wrong screen
  // Fonts are held back with it so the hero never flashes in the system font.
  if (onboarded === null || (!fontsLoaded && !fontError)) return null;

  const tree = (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={() => {
        lastScreenRef.current = navigationRef.getCurrentRoute()?.name;
        if (lastScreenRef.current) logScreenView(lastScreenRef.current);
        handleColdStartNotification();
      }}
      onStateChange={() => {
        const current = navigationRef.getCurrentRoute()?.name;
        if (current && current !== lastScreenRef.current) logScreenView(current);
        lastScreenRef.current = current;
      }}
    >
      <StatusBar style="dark" />
      {/* Auth screens live on a root stack ABOVE the tab navigator, not inside
          a tab's stack. Two reasons: they cover the tab bar and carry no header
          of ours, so Clerk's own chrome (its close button, its titles) is the
          only chrome on screen; and guard() can reach them from any tab. While
          SignIn lived in HomeStack, voting from a Search-tab question had to
          bounce through the Browse tab to find the route. */}
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {onboarded === false ? (
          <RootStack.Screen name="InitialOnboarding">
            {() => <OnboardingScreen onDone={() => setOnboarded(true)} />}
          </RootStack.Screen>
        ) : (
          <>
            <RootStack.Screen name="Tabs" component={TabsNavigator} />
            <RootStack.Screen
              name="SignIn"
              component={SignInScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <RootStack.Screen
              name="ManageAccount"
              component={ManageAccountScreen}
              options={{ presentation: 'fullScreenModal' }}
            />
            <RootStack.Screen
              name="Onboarding"
              options={{ presentation: 'fullScreenModal' }}
            >
              {({ navigation }: any) => (
                <OnboardingScreen onDone={() => navigation.goBack()} />
              )}
            </RootStack.Screen>
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );

  // Production renders exactly what it rendered before this banner existed.
  if (!__DEV__) {
    return (
      <>
        {tree}
        <UpdateRequiredScreen />
        <MermaidWorker />
      </>
    );
  }

  // The banner eats the top safe-area inset itself, so the navigators below
  // are handed top: 0 - otherwise every screen header would pad for a status
  // bar that the banner is already sitting under.
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.text }}>
      <BackendDebugBanner />
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        {tree}
      </SafeAreaInsetsContext.Provider>
      <UpdateRequiredScreen />
      <MermaidWorker />
    </View>
  );
}
