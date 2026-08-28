import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from '../api';
import { getVoterId } from './voterId';
import { navigationRef } from './navigationRef';

// Merely importing expo-notifications throws on Android in Expo Go (SDK 53+
// removed remote push support there - see warnOfExpoGoPushUsage, which runs
// as an import-time side effect, not from anything we call). A static
// top-level `import` is hoisted and evaluated before any of our own guard
// code runs, so the only way to avoid the crash is to never import the
// module at all in Expo Go - hence the lazy `require` below instead.
// Web is nulled out for a different reason than Expo Go, but with the same
// answer: the web target is a layout preview of the Android app, and
// expo-notifications there needs a `notification.vapidPublicKey` in app.json
// that we deliberately don't configure. Without this guard every page load
// logs a failed getExpoPushTokenAsync, and getLastNotificationResponseAsync
// isn't implemented on web at all - an uncaught rejection each time.
const isUnsupportedPlatform = isRunningInExpoGo() || Platform.OS === 'web';
const Notifications = isUnsupportedPlatform
  ? null
  : (require('expo-notifications') as typeof import('expo-notifications'));

// Foreground display behavior - without this, a notification that arrives
// while the app is already open shows nothing at all.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission (no-ops if already granted/denied) and registers this
// device's Expo push token with the backend. No user accounts exist, so
// this is unconditional - every device that grants permission gets
// registered, there's no per-user opt-in beyond the OS permission prompt.
export const registerForPushNotificationsAsync = async () => {
  if (!Notifications) {
    console.log(
      Platform.OS === 'web'
        ? 'Skipping push notification registration - not supported on the web preview build.'
        : 'Skipping push notification registration - not supported in Expo Go, use a dev build.'
    );
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.error('No EAS projectId configured - cannot register for push notifications');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const voterId = await getVoterId().catch(() => undefined);
    await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android', voterId);
  } catch (e) {
    console.error('Failed to register push token', e);
  }
};

// Deep-links into a question when a notification carrying
// { subjectId, questionId } is tapped - matches the `data` payload shape
// the admin send_notification MCP tool documents and the targeted
// "your report was fixed" push (includes year). A plain announcement
// (no data) just brings the app to the foreground, nothing to navigate to.
const navigateFromNotificationData = (data: unknown) => {
  const payload = data as
    | { subjectId?: string; questionId?: string; semesterId?: string; subjectName?: string; year?: number }
    | undefined;
  if (!payload?.subjectId || !payload?.questionId || !navigationRef.isReady()) return;
  navigationRef.navigate('Browse', {
    screen: 'QuestionDetail',
    params: {
      subjectId: payload.subjectId,
      questionId: payload.questionId,
      semesterId: payload.semesterId,
      subjectName: payload.subjectName,
      year: payload.year,
    },
  });
};

// Handles a notification tapped while the JS runtime is already running.
// Returns an unsubscribe function.
export const subscribeToNotificationResponses = () => {
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromNotificationData(response.notification.request.content.data);
  });
  return () => subscription.remove();
};

// Handles the app being cold-started by tapping a notification - call once
// navigationRef is actually ready (NavigationContainer's onReady), since
// navigating before that is a no-op.
export const handleColdStartNotification = async () => {
  if (!Notifications) return;

  const response = await Notifications.getLastNotificationResponseAsync();
  navigateFromNotificationData(response?.notification.request.content.data);
};
