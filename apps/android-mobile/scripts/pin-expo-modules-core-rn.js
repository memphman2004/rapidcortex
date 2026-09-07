/**
 * ExpoModulesCore.podspec probes React Native with:
 *   node --print "require('react-native/package.json').version"
 *
 * In this npm workspace that resolves the hoisted peer at the repo root
 * (React Native 0.80.x from web/React 19 peers), not the app's 0.76.9.
 * Minor >= 77 makes ExpoModulesCore depend on ReactAppDependencyProvider,
 * which SDK 52 / RN 0.76 never generates → CocoaPods "Unable to find a
 * specification for ReactAppDependencyProvider".
 */

const MARKER = 'Rapid Cortex: pin React Native from the mobile app';

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
 * @param {string} version
 * @returns {boolean}
 */
function isSdk52ReactNative(version) {
  return reactNativeMinor(version) === 76;
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
  rubySingleQuote,
  reactNativeMinor,
  isSdk52ReactNative,
  patchExpoModulesCorePodspec,
  podspecIsPinned,
};
