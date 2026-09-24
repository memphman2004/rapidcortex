/**
 * ExpoModulesCore.podspec probes React Native with:
 *   node --print "require('react-native/package.json').version"
 *
 * In this npm workspace that can resolve a hoisted peer at the repo root
 * (React Native 0.80+/0.81 from other workspaces), not the app's 0.79.x.
 * Pin probes to the mobile app's react-native so CocoaPods and Gradle
 * agree with the JS bundle.
 */

const MARKER = 'NexCort iQ: pin React Native from the mobile app';

/** Expo SDK 53 ships React Native 0.79.x. */
const PINNED_RN_MINOR = 79;

/**
 * @param {string} absPath
 * @returns {string}
 */
function rubySingleQuote(absPath) {
  return absPath.replace(/\\/g, '/').replace(/'/g, "\\'");
}

/**
 * @param {string} version
 * @returns {number}
 */
function reactNativeMinor(version) {
  const minor = String(version).trim().split('.')[1];
  return Number.parseInt(minor, 10);
}

/**
 * True when `version` is the React Native series this app is pinned to.
 *
 * @param {string} version
 * @returns {boolean}
 */
function isPinnedMobileReactNative(version) {
  return reactNativeMinor(version) === PINNED_RN_MINOR;
}

/**
 * Rewrite ExpoModulesCore.podspec so version + react_native_pods come from
 * the mobile app's react-native, not Node's cwd-based resolution.
 *
 * @param {string} contents
 * @param {string} rnPackageJsonPath absolute path to react-native/package.json
 * @returns {string}
 */
function patchExpoModulesCorePodspec(contents, rnPackageJsonPath) {
  const quoted = rubySingleQuote(rnPackageJsonPath);
  let next = contents;

  next = next.replace(
    /absolute_react_native_path = File\.dirname\(`node --print "require\.resolve\('react-native\/package\.json'\)"`\)/,
    `absolute_react_native_path = File.dirname('${quoted}') # ${MARKER}`,
  );

  next = next.replace(
    /absolute_react_native_path = File\.dirname\('(?:\\'|[^'])+'\)(?: # .*)?/,
    `absolute_react_native_path = File.dirname('${quoted}') # ${MARKER}`,
  );

  next = next.replace(
    /reactNativeVersion = `node --print "require\('#\{absolute_react_native_path\}\/package\.json'\)\.version"`/,
    `reactNativeVersion = JSON.parse(File.read('${quoted}'))['version'] # ${MARKER}`,
  );

  next = next.replace(
    /require File\.join\(File\.dirname\(`node --print "require\.resolve\('react-native\/package\.json'\)"`\), "scripts\/react_native_pods"\)/,
    `require File.join(File.dirname('${quoted}'), "scripts/react_native_pods") # ${MARKER}`,
  );

  next = next.replace(
    /require File\.join\(File\.dirname\('(?:\\'|[^'])+'\), "scripts\/react_native_pods"\)(?: # .*)?/,
    `require File.join(File.dirname('${quoted}'), "scripts/react_native_pods") # ${MARKER}`,
  );

  next = next.replace(
    /reactNativeVersion = `node --print "require\('react-native\/package\.json'\)\.version"`/,
    `reactNativeVersion = JSON.parse(File.read('${quoted}'))['version'] # ${MARKER}`,
  );

  next = next.replace(
    /reactNativeVersion = JSON\.parse\(File\.read\('(?:\\'|[^'])+'\)\)\['version'\](?: # .*)?/,
    `reactNativeVersion = JSON.parse(File.read('${quoted}'))['version'] # ${MARKER}`,
  );

  return next;
}

function podspecIsPinned(contents) {
  return contents.includes(MARKER);
}

module.exports = {
  MARKER,
  PINNED_RN_MINOR,
  rubySingleQuote,
  reactNativeMinor,
  isPinnedMobileReactNative,
  patchExpoModulesCorePodspec,
  podspecIsPinned,
};
