const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.resolver.extraNodeModules = {
  punycode: require.resolve('punycode/'),
};

module.exports = config;