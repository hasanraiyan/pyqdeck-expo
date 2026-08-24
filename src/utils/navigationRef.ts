import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the component tree (notification-tap handling) navigate
// without needing a useNavigation() hook - attached to <NavigationContainer
// ref={navigationRef}> in App.tsx.
export const navigationRef = createNavigationContainerRef<any>();
