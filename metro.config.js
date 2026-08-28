const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.resolver.extraNodeModules = {
  punycode: require.resolve('punycode/'),
};

// Native-only packages that don't ship a web build. Metro resolves require()
// statically, so the guarded try/catch requires in src/utils/* aren't enough -
// the bundler still has to resolve the module, and these fail on web (e.g.
// sp-react-native-in-app-updates only ships InAppUpdates.android.js/.ios.js).
// Resolving them to an empty module on web makes those guards fall into their
// null branch, which is exactly the "native module not available" path they
// already handle.
const WEB_STUBBED_MODULES = new Set([
  'sp-react-native-in-app-updates',
  'react-native-google-mobile-ads',
]);

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBBED_MODULES.has(moduleName)) {
    return { type: 'empty' };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(
    context,
    moduleName,
    platform
  );
};

module.exports = config;
