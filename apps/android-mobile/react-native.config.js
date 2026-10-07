/**
 * Preview/production APKs must not RN-autolink Expo Dev Launcher.
 * When those packages stay in the release DEX they double-init JSI and native
 * calls AppRegistry against an empty BatchedBridge — "keeps stopping" after
 * splash (callFunctionReturnFlushedQueue undefined / modules n=0).
 *
 * Local Metro / EAS profile "development" keep the packages linked.
 */
const profile = process.env.EAS_BUILD_PROFILE;
const skipDevClient = Boolean(profile) && profile !== 'development';

const disabledPlatforms = { platforms: { android: null, ios: null } };

module.exports = {
  dependencies: skipDevClient
    ? {
        'expo-dev-client': disabledPlatforms,
        'expo-dev-launcher': disabledPlatforms,
        'expo-dev-menu': disabledPlatforms,
        'expo-dev-menu-interface': disabledPlatforms,
      }
    : {},
};
