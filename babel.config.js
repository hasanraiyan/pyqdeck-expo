module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        require.resolve('babel-plugin-module-resolver'),
        {
          root: ['.'],
          alias: {
            // sp-react-native-in-app-updates depends on react-native-device-info, which
            // isn't Expo Go-safe. This redirects it to a thin expo-constants-backed shim
            // (see react-native-device-info.js) instead of pulling in the real native module.
            'react-native-device-info': './react-native-device-info.js',
          },
        },
      ],
    ],
  };
};
