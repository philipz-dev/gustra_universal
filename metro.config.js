const { getSentryExpoConfig } = require('@sentry/react-native/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Keep Metro's crawler off huge / generated trees (ios/Pods ~1GB) so `expo start`
// does not hang while building the file map.
const extraBlock = [
  /GUSTRA_UNIVERSAL_FULL\.txt$/,
  /\/localization\//,
  /\/build-.*\.(ipa|aab)$/,
  /\/secrets\//,
  /\/ios\/Pods\//,
  /\/ios\/build\//,
  /\/ios\/\.xcode\.env\.local$/,
  /\/android\/\.gradle\//,
  /\/android\/build\//,
  /\/android\/app\/build\//,
  /\/\.expo\/web\//,
  /\/roadmap\//,
];

const prev = config.resolver.blockList;
config.resolver.blockList = Array.isArray(prev)
  ? [...prev, ...extraBlock]
  : prev
    ? [prev, ...extraBlock]
    : extraBlock;

module.exports = config;
