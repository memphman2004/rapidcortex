/**
 * TestFlight 34 still compiled expo-dev-launcher into the Release archive.
 * SDK 52 marks those pods debugOnly, but CocoaPods still builds them for
 * Release-iphoneos. ExpoDevLauncherAppDelegateSubscriber then fatalErrors
 * on launch because UIScene has not made a key window yet.
 *
 * Android preview APKs had the same packages in the release DEX. DevLauncher
 * double-inits JSI and native then calls AppRegistry.runApplication against an
 * empty BatchedBridge (callable modules n = 0) after splash.
 *
 * Production and preview EAS (`EAS_BUILD_PROFILE` not `development`) must not link:
 * expo-dev-client, expo-dev-launcher, expo-dev-menu, expo-dev-menu-interface.
 * Local Debug / the development EAS profile keep them for Metro.
 */
const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = 'RAPID_CORTEX_STORE_SKIP_DEV_CLIENT';
const EXCLUDE = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
];

/** Any EAS profile that is not a Metro dev client (production + preview). */
function isStoreBuild() {
  const profile = process.env.EAS_BUILD_PROFILE;
  return Boolean(profile) && profile !== 'development';
}

/** @deprecated Use isStoreBuild — kept so existing tests and iOS call sites keep working. */
function isIosStoreBuild() {
  return isStoreBuild();
}

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchPodfileUseExpoModules(contents) {
  if (contents.includes(MARKER)) {
    return { contents, changed: false };
  }
  const re = /^([ \t]*)use_expo_modules!.*$/m;
  if (!re.test(contents)) {
    return { contents, changed: false };
  }
  const excludeLit = EXCLUDE.map((name) => `'${name}'`).join(', ');
  const next = contents.replace(
    re,
    `$1# ${MARKER}: TestFlight must not link Expo Dev Launcher (keyWindow fatal).
$1if ENV['EAS_BUILD_PROFILE'] && ENV['EAS_BUILD_PROFILE'] != 'development'
$1  use_expo_modules!(exclude: [${excludeLit}])
$1else
$1  use_expo_modules!
$1end`,
  );
  return { contents: next, changed: true };
}

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchSettingsGradleUseExpoModules(contents) {
  if (contents.includes(MARKER)) {
    return { contents, changed: false };
  }
  const re = /^([ \t]*)useExpoModules\(\)\s*$/m;
  if (!re.test(contents)) {
    return { contents, changed: false };
  }
  const excludeLit = EXCLUDE.map((name) => `"${name}"`).join(', ');
  const next = contents.replace(
    re,
    `$1// ${MARKER}: preview/production APKs must not link Expo Dev Launcher
$1// (empty AppRegistry / callable modules n=0 after splash).
$1if (System.getenv("EAS_BUILD_PROFILE") && System.getenv("EAS_BUILD_PROFILE") != "development") {
$1  useExpoModules([exclude: [${excludeLit}]])
$1} else {
$1  useExpoModules()
$1}`,
  );
  return { contents: next, changed: true };
}

/**
 * @param {Record<string, unknown>} pkgJson
 * @returns {Record<string, unknown>}
 */
function patchPackageJsonAutolinking(pkgJson) {
  const expo =
    pkgJson.expo && typeof pkgJson.expo === 'object' && !Array.isArray(pkgJson.expo)
      ? { ...pkgJson.expo }
      : {};
  const autolinking =
    expo.autolinking && typeof expo.autolinking === 'object' && !Array.isArray(expo.autolinking)
      ? { ...expo.autolinking }
      : {};
  const existing = Array.isArray(autolinking.exclude) ? autolinking.exclude : [];
  autolinking.exclude = [...new Set([...existing, ...EXCLUDE])];
  expo.autolinking = autolinking;
  return { ...pkgJson, expo };
}

/**
 * @param {string} projectRoot
 */
function writeAutolinkingExclude(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const next = patchPackageJsonAutolinking(pkg);
  fs.writeFileSync(pkgPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`[store-skip-dev-client] production autolinking exclude: ${EXCLUDE.join(', ')}`);
}

function withStoreSkipDevClient(config) {
  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const original = fs.readFileSync(podfilePath, 'utf8');
      const { contents, changed } = patchPodfileUseExpoModules(original);
      if (isStoreBuild() && !contents.includes('use_expo_modules!')) {
        throw new Error(
          '[store-skip-dev-client] Podfile has no use_expo_modules! — cannot exclude expo-dev-launcher from TestFlight',
        );
      }
      if (isStoreBuild() && !contents.includes(MARKER)) {
        throw new Error(
          '[store-skip-dev-client] failed to patch use_expo_modules! for production exclude',
        );
      }
      if (changed) {
        fs.writeFileSync(podfilePath, contents);
        console.log(`[store-skip-dev-client] ${MARKER} hooked into Podfile`);
      }

      if (isStoreBuild()) {
        writeAutolinkingExclude(cfg.modRequest.projectRoot);
      }
      return cfg;
    },
  ]);

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const settingsPath = path.join(cfg.modRequest.platformProjectRoot, 'settings.gradle');
      const original = fs.readFileSync(settingsPath, 'utf8');
      const { contents, changed } = patchSettingsGradleUseExpoModules(original);
      if (isStoreBuild() && !contents.includes('useExpoModules()')) {
        throw new Error(
          '[store-skip-dev-client] settings.gradle has no useExpoModules() — cannot exclude expo-dev-launcher from Android preview',
        );
      }
      if (isStoreBuild() && !contents.includes(MARKER)) {
        throw new Error(
          '[store-skip-dev-client] failed to patch useExpoModules() for Android production exclude',
        );
      }
      if (changed) {
        fs.writeFileSync(settingsPath, contents);
        console.log(`[store-skip-dev-client] ${MARKER} hooked into settings.gradle`);
      }

      if (isStoreBuild()) {
        writeAutolinkingExclude(cfg.modRequest.projectRoot);
      }
      return cfg;
    },
  ]);
}

module.exports = withStoreSkipDevClient;
module.exports.MARKER = MARKER;
module.exports.EXCLUDE = EXCLUDE;
module.exports.isStoreBuild = isStoreBuild;
module.exports.isIosStoreBuild = isIosStoreBuild;
module.exports.patchPodfileUseExpoModules = patchPodfileUseExpoModules;
module.exports.patchSettingsGradleUseExpoModules = patchSettingsGradleUseExpoModules;
module.exports.patchPackageJsonAutolinking = patchPackageJsonAutolinking;
