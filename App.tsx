import React, { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  useSafeAreaInsets,
  SafeAreaProvider,
  SafeAreaInsetsContext,
} from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { clerkPublishableKey } from './src/auth/publishableKey';
import { mobileAds } from './src/utils/mobileAds';
import { navigationRef } from './src/utils/navigationRef';
import * as Backend from './src/api/backend';
import { BackendDebugBanner } from './src/components/BackendDebugBanner';
import {
  registerForPushNotificationsAsync,
  subscribeToNotificationResponses,
  handleColdStartNotification,
} from './src/utils/notifications';
import { COLORS } from './src/theme/colors';
import { HomeScreen } from './src/screens/HomeScreen';
import { SubjectListScreen } from './src/screens/SubjectListScreen';
import { SubjectDetailScreen } from './src/screens/SubjectDetailScreen';
import { AllSubjectsScreen } from './src/screens/AllSubjectsScreen';
import { QuestionListScreen } from './src/screens/QuestionListScreen';
import { QuestionDetailScreen } from './src/screens/QuestionDetailScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { BranchScreen } from './src/screens/BranchScreen';
import { SemesterSelectScreen } from './src/screens/SemesterSelectScreen';
import { SyllabusOverviewScreen } from './src/screens/SyllabusOverviewScreen';
import { SubjectSyllabusScreen } from './src/screens/SubjectSyllabusScreen';
import { SyllabusTabIcon } from './src/components/SyllabusTabIcon';
import { checkForStoreUpdate } from './src/utils/appUpdate';
import { maybeRequestReview } from './src/utils/appReview';
import { isSyllabusEnabled } from './src/config/features';
import * as Sentry from '@sentry/react-native';

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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Mirrors pyqdeck-frontend's /[semester]/[subject]/[year]/[questionId] route
// (see app.json's Android App Links intentFilters + the site's
// public/.well-known/assetlinks.json), so a shared question link opens
// straight to that question whether the app is installed or not.
const linking: any = {
  prefixes: ['https://pyqdeck.in', 'https://www.pyqdeck.in'],
  config: {
    screens: {
      Browse: {
        screens: {
          QuestionDetail: ':semesterId/:subjectId/:year/:questionId',
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
    fontWeight: '600' as const,
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: COLORS.background,
  },
};

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
        name="SubjectDetail"
        component={SubjectDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.subjectName || 'Subject',
        })}
      />
      <Stack.Screen
        name="QuestionList"
        component={QuestionListScreen}
        options={({ route }: any) => ({
          title: route.params?.subjectName || 'Questions',
        })}
      />
      <Stack.Screen
        name="QuestionDetail"
        component={QuestionDetailScreen}
        options={{
          title: 'Question Paper',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        // Not just "Sign in": AuthView runs Clerk's combined signInOrUp flow,
        // so an unrecognised email creates the account on this same screen.
        options={{ title: 'Sign in or sign up', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

/** Branch -> semester -> subjects -> topics, each its own screen. */
function SyllabusStack() {
  return (
    <Stack.Navigator screenOptions={commonScreenOptions}>
      <Stack.Screen
        name="BranchRoot"
        component={BranchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SemesterSelect"
        component={SemesterSelectScreen}
        options={({ route }: any) => ({
          title: route.params?.branchId?.toUpperCase() || 'Semesters',
        })}
      />
      <Stack.Screen
        name="SyllabusOverview"
        component={SyllabusOverviewScreen}
        options={({ route }: any) => ({ title: `Semester ${route.params?.semester ?? ''}` })}
      />
      <Stack.Screen
        name="SubjectSyllabus"
        component={SubjectSyllabusScreen}
        options={({ route }: any) => ({ title: route.params?.subjectName || 'Subject' })}
      />
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
      <Stack.Screen
        name="SubjectDetail"
        component={SubjectDetailScreen}
        options={({ route }: any) => ({
          title: route.params?.subjectName || 'Subject',
        })}
      />
      <Stack.Screen
        name="QuestionList"
        component={QuestionListScreen}
        options={({ route }: any) => ({
          title: route.params?.subjectName || 'Questions',
        })}
      />
      <Stack.Screen
        name="QuestionDetail"
        component={QuestionDetailScreen}
        options={{
          title: 'Question Paper',
        }}
      />
    </Stack.Navigator>
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
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </ClerkProvider>
  );
});

function AppContent() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mobileAds().initialize();
    registerForPushNotificationsAsync();
    const unsubscribe = subscribeToNotificationResponses();

    // Start backend selection alongside the rest of boot instead of letting
    // the first screen's fetch trigger it, so the ping RTT overlaps app
    // startup rather than delaying the first request.
    void Backend.ready();

    // A session that fell back to Render should climb back onto EC2 once it
    // recovers. Returning to the foreground is the natural moment to look,
    // and recheckIfStale() ignores brief tab-aways.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') Backend.recheckIfStale();
    });

    // Sequenced so a store-update prompt and a review prompt never show back to back.
    checkForStoreUpdate().finally(() => {
      maybeRequestReview();
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, []);

  const tree = (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={handleColdStartNotification}
    >
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.card,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
            paddingTop: 6,
          },
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.textMuted,
        }}
      >
        <Tab.Screen
          name="Browse"
          component={HomeStack}
          options={{
            tabBarLabel: 'Browse',
            tabBarIcon: ({ color, size }) => (
              <Feather name="book-open" size={size} color={color} />
            ),
          }}
        />
        {isSyllabusEnabled && (
          <Tab.Screen
            name="Syllabus"
            component={SyllabusStack}
            options={{
              tabBarLabel: 'Syllabus',
              tabBarIcon: ({ color, size, focused }) => (
                <SyllabusTabIcon size={size} color={color} focused={focused} />
              ),
            }}
          />
        )}
        <Tab.Screen
          name="Search"
          component={SearchStack}
          options={{
            tabBarLabel: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Feather name="search" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );

  // Production renders exactly what it rendered before this banner existed.
  if (!__DEV__) return tree;

  // The banner eats the top safe-area inset itself, so the navigators below
  // are handed top: 0 - otherwise every screen header would pad for a status
  // bar that the banner is already sitting under.
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.text }}>
      <BackendDebugBanner />
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        {tree}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
