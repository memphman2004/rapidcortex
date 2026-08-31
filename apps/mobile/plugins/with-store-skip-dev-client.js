/**
 * TestFlight 34 still compiled expo-dev-launcher into the Release archive.
 * SDK 52 marks those pods debugOnly, but CocoaPods still builds them for
 * Release-iphoneos. ExpoDevLauncherAppDelegateSubscriber then fatalErrors
 * on launch because UIScene has not made a key window yet.
 *
 * Production EAS (`EAS_BUILD_PROFILE=production`) must not link:
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

function isIosStoreBuild() {
  return process.env.EAS_BUILD_PROFILE === 'production';
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
$1if ENV['EAS_BUILD_PROFILE'] == 'production'
$1  use_expo_modules!(exclude: [${excludeLit}])
$1else
$1  use_expo_modules!
$1end`,
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

function withStoreSkipDevClient(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const original = fs.readFileSync(podfilePath, 'utf8');
      const { contents, changed } = patchPodfileUseExpoModules(original);
      if (isIosStoreBuild() && !contents.includes('use_expo_modules!')) {
        throw new Error(
          '[store-skip-dev-client] Podfile has no use_expo_modules! — cannot exclude expo-dev-launcher from TestFlight',
        );
      }
      if (isIosStoreBuild() && !contents.includes(MARKER)) {
        throw new Error(
          '[store-skip-dev-client] failed to patch use_expo_modules! for production exclude',
        );
      }
      if (changed) {
        fs.writeFileSync(podfilePath, contents);
        console.log(`[store-skip-dev-client] ${MARKER} hooked into Podfile`);
      }

      if (isIosStoreBuild()) {
        const pkgPath = path.join(cfg.modRequest.projectRoot, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const next = patchPackageJsonAutolinking(pkg);
        fs.writeFileSync(pkgPath, `${JSON.stringify(next, null, 2)}\n`);
        console.log(
          `[store-skip-dev-client] production autolinking exclude: ${EXCLUDE.join(', ')}`,
        );
      }
      return cfg;
    },
  ]);
}

module.exports = withStoreSkipDevClient;
module.exports.MARKER = MARKER;
module.exports.EXCLUDE = EXCLUDE;
module.exports.isIosStoreBuild = isIosStoreBuild;
module.exports.patchPodfileUseExpoModules = patchPodfileUseExpoModules;
module.exports.patchPackageJsonAutolinking = patchPackageJsonAutolinking;
