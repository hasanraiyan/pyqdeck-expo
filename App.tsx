import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import mobileAds from 'react-native-google-mobile-ads';
import { COLORS } from './src/theme/colors';
import { HomeScreen } from './src/screens/HomeScreen';
import { SubjectListScreen } from './src/screens/SubjectListScreen';
import { SubjectDetailScreen } from './src/screens/SubjectDetailScreen';
import { AllSubjectsScreen } from './src/screens/AllSubjectsScreen';
import { QuestionListScreen } from './src/screens/QuestionListScreen';
import { QuestionDetailScreen } from './src/screens/QuestionDetailScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { checkForStoreUpdate } from './src/utils/appUpdate';
import { maybeRequestReview } from './src/utils/appReview';

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
          title: `Semester ${route.params?.semesterNumber || ''}`,
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

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mobileAds().initialize();

    // Sequenced so a store-update prompt and a review prompt never show back to back.
    checkForStoreUpdate().finally(() => {
      maybeRequestReview();
    });
  }, []);

  return (
    <NavigationContainer linking={linking}>
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
}




