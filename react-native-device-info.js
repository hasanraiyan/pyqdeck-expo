// Shim for react-native-device-info, aliased in via babel.config.js.
// sp-react-native-in-app-updates only needs bundle id + version, both of which
// expo-constants already exposes - no need for the real native module.
import Constants from 'expo-constants';

export const getBundleId = () => {
  return Constants.expoConfig?.ios?.bundleIdentifier ?? Constants.expoConfig?.android?.package ?? '';
};

export const getVersion = () => {
  return Constants.expoConfig?.version ?? '1.0.0';
};

export default {
  getBundleId,
  getVersion,
};
