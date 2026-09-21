import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pyqdeck:onboarded';

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, 'true');
  } catch {
    // silently ignore write errors
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // silently ignore write errors
  }
}

