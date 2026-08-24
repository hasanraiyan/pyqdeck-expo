import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from '../api';
import { navigationRef } from './navigationRef';

// Foreground display behavior - without this, a notification that arrives
// while the app is already open shows nothing at all.
Notifications.setNotificationHandler({
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
    await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch (e) {
    console.error('Failed to register push token', e);
  }
};

// Deep-links into a question when a notification carrying
// { subjectId, questionId } is tapped - matches the `data` payload shape
// the admin send_notification MCP tool documents. A plain announcement
// (no data) just brings the app to the foreground, nothing to navigate to.
const navigateFromNotificationData = (data: unknown) => {
  const payload = data as
    | { subjectId?: string; questionId?: string; semesterId?: string; subjectName?: string }
    | undefined;
  if (!payload?.subjectId || !payload?.questionId || !navigationRef.isReady()) return;
  navigationRef.navigate('Browse', {
    screen: 'QuestionDetail',
    params: {
      subjectId: payload.subjectId,
      questionId: payload.questionId,
      semesterId: payload.semesterId,
      subjectName: payload.subjectName,
    },
  });
};

// Handles a notification tapped while the JS runtime is already running.
// Returns an unsubscribe function.
export const subscribeToNotificationResponses = () => {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromNotificationData(response.notification.request.content.data);
  });
  return () => subscription.remove();
};

// Handles the app being cold-started by tapping a notification - call once
// navigationRef is actually ready (NavigationContainer's onReady), since
// navigating before that is a no-op.
export const handleColdStartNotification = async () => {
  const response = await Notifications.getLastNotificationResponseAsync();
  navigateFromNotificationData(response?.notification.request.content.data);
};
