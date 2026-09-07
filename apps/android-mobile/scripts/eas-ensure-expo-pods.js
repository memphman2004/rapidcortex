/**
 * EAS installs npm workspaces with Expo hoisted to the monorepo root.
 * CocoaPods (from apps/android-mobile/ios) only looks in apps/android-mobile/node_modules,
 * so ExpoModulesCore / Expo* pods go missing. Materialize them locally.
 *
 * Also pin ExpoModulesCore's React Native version probe to the mobile app's
 * 0.76.9 — a hoisted RN 0.80 peer at the repo root makes pod install fail
 * looking for ReactAppDependencyProvider.
 *
 * Nest commander 7.x under expo-modules-autolinking so Xcode Configure project
 * does not load RN's commander 12 (`commander_1.default.command is not a function`).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  isSdk52ReactNative,
  patchExpoModulesCorePodspec,
} = require('./pin-expo-modules-core-rn.js');

const mobileRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(mobileRoot, '../..');
const mobileNm = path.join(mobileRoot, 'node_modules');
const rootNm = path.join(workspaceRoot, 'node_modules');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * A silently-failed version pin here does not fail the EAS build — it ships a
 * native binary whose react-native/react-native-screens/expo-modules-core
 * version disagrees with the JS bundle Metro produced. That mismatch is a
 * known cause of native-stack screens mounting but rendering nothing (black
 * screen after splash), with no crash and no error to point at. Fail loud
 * instead of warning and continuing.
 */
function fail(message) {
  throw new Error(`[eas-pods] FATAL: ${message}`);
}

/** Copy a nested mobile package up to the workspace root so hoisted Expo tooling can resolve it. */
function hoistToRoot(pkg) {
  const dest = path.join(rootNm, pkg);
  const src = path.join(mobileNm, pkg);
  if (fs.existsSync(dest)) {
    console.log(`[eas-pods] ${pkg} already hoisted at ${dest}`);
    return dest;
  }
  if (!fs.existsSync(src)) {
    console.warn(`[eas-pods] cannot hoist ${pkg}, missing ${src}`);
    return null;
  }
  ensureDir(rootNm);
  console.log(`[eas-pods] hoisting ${pkg} → workspace node_modules`);
  execSync(`cp -R "${src}" "${dest}"`, { stdio: 'inherit' });
  return dest;
}

function buildSharedPackage() {
  const sharedPkg = path.join(workspaceRoot, 'packages/shared/package.json');
  if (!fs.existsSync(sharedPkg)) {
    console.warn('[eas-pods] packages/shared missing; skip build');
    return;
  }
  const distIndex = path.join(workspaceRoot, 'packages/shared/dist/index.js');
  console.log('[eas-pods] building rapid-cortex-shared for Metro');
  execSync('npm run build -w rapid-cortex-shared', {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
  console.log(
    `[eas-pods] rapid-cortex-shared dist ${fs.existsSync(distIndex) ? 'OK' : 'MISSING'}`,
  );
}

function readPkgVersion(pkgDir) {
  const pkg = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkg)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
}

function materialize(pkg, { requireSdk52Rn = false } = {}) {
  const dest = path.join(mobileNm, pkg);
  const src = path.join(rootNm, pkg);
  if (fs.existsSync(dest)) {
    if (requireSdk52Rn) {
      const destVersion = readPkgVersion(dest);
      if (destVersion && !isSdk52ReactNative(destVersion)) {
        console.warn(
          `[eas-pods] replacing ${pkg}@${destVersion} at ${dest} (not SDK 52 / 0.76)`
        );
        fs.rmSync(dest, { recursive: true, force: true });
      } else {
        console.log(`[eas-pods] ${pkg}@${destVersion} already present at ${dest}`);
        return dest;
      }
    } else {
      console.log(`[eas-pods] ${pkg} already present at ${dest}`);
      return dest;
    }
  }
  if (!fs.existsSync(src)) {
    console.warn(`[eas-pods] missing source ${src}`);
    return null;
  }
  if (requireSdk52Rn) {
    const srcVersion = readPkgVersion(src);
    if (!srcVersion || !isSdk52ReactNative(srcVersion)) {
      console.warn(
        `[eas-pods] skip copying ${pkg}@${srcVersion ?? 'unknown'} from root (need 0.76.x)`
      );
      return fs.existsSync(dest) ? dest : null;
    }
  }
  ensureDir(mobileNm);
  console.log(`[eas-pods] copying ${pkg} → apps/android-mobile/node_modules`);
  execSync(`cp -R "${src}" "${dest}"`, { stdio: 'inherit' });
  return dest;
}

function resolveMobileReactNativePackageJson() {
  const candidates = [
    path.join(mobileNm, 'react-native'),
    path.join(rootNm, 'react-native'),
  ];
  for (const dir of candidates) {
    const version = readPkgVersion(dir);
    if (version && isSdk52ReactNative(version)) {
      return path.join(dir, 'package.json');
    }
    if (version) {
      console.warn(`[eas-pods] ignore react-native@${version} at ${dir}`);
    }
  }
  return null;
}

function pinExpoModulesCorePodspecs(rnPackageJson) {
  const podspecs = [
    path.join(mobileNm, 'expo-modules-core', 'ExpoModulesCore.podspec'),
    path.join(rootNm, 'expo-modules-core', 'ExpoModulesCore.podspec'),
  ];
  for (const podspecPath of podspecs) {
    if (!fs.existsSync(podspecPath)) {
      continue;
    }
    const before = fs.readFileSync(podspecPath, 'utf8');
    const after = patchExpoModulesCorePodspec(before, rnPackageJson);
    if (after === before) {
      console.error(
        `[eas-pods] did not patch ${podspecPath} (pattern mismatch) — ` +
          'ExpoModulesCore may probe a hoisted, non-0.76 react-native during pod install.',
      );
      continue;
    }
    fs.writeFileSync(podspecPath, after);
    console.log(`[eas-pods] pinned RN probe in ${podspecPath}`);
  }
}

ensureDir(mobileNm);
for (const pkg of ['expo', 'expo-modules-core']) {
  materialize(pkg);
}
materialize('react-native', { requireSdk52Rn: true });
{
  const mobileRnVersion = readPkgVersion(path.join(mobileNm, 'react-native'));
  if (!mobileRnVersion || !isSdk52ReactNative(mobileRnVersion)) {
    fail(
      `apps/android-mobile/node_modules/react-native is ${mobileRnVersion ?? 'missing'}, need 0.76.x. ` +
        'Metro will bundle against a different react-native than the native binary was built with.',
    );
  }
}
pinHoistedReactNativeToSdk52();
pinExpoModulesAutolinkingToSdk52();
pinCommanderForExpoAutolinking();
// babel-preset-expo (hoisted) uses require.resolve('expo-router'); that fails
// when the package only exists under apps/android-mobile/node_modules.
if (!hoistToRoot('expo-router')) {
  fail('could not hoist expo-router to the workspace root — export:embed will fail.');
}
buildSharedPackage();

const { materializeNestedPolyfills } = require('./metro-resolve-nested.js');
const nestedCopied = materializeNestedPolyfills(mobileRoot, workspaceRoot);
if (nestedCopied.length > 0) {
  console.log(`[eas-pods] materialized Metro polyfills:\n  ${nestedCopied.join('\n  ')}`);
}

function replacePackageTree(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  ensureDir(path.dirname(dest));
  execSync(`cp -R "${src}" "${dest}"`, { stdio: 'inherit' });
}

function pinHoistedReactNativeToSdk52() {
  const mobileRn = path.join(mobileNm, 'react-native');
  const rootRn = path.join(rootNm, 'react-native');
  const mobileVer = readPkgVersion(mobileRn);
  const rootVer = readPkgVersion(rootRn);
  if (!mobileVer || !isSdk52ReactNative(mobileVer)) {
    console.warn(
      `[eas-pods] apps/android-mobile react-native@${mobileVer ?? 'missing'} (need 0.76.x)`,
    );
    return;
  }
  if (rootVer && isSdk52ReactNative(rootVer)) {
    console.log(`[eas-pods] hoisted react-native@${rootVer} is SDK 52`);
    return;
  }
  if (!rootVer) {
    console.log(`[eas-pods] hoisting react-native@${mobileVer} to workspace root`);
  } else {
    console.log(
      `[eas-pods] replacing hoisted react-native@${rootVer} with ${mobileVer} (Android Gradle resolves the root tree)`,
    );
  }
  replacePackageTree(mobileRn, rootRn);
}

function pinExpoModulesAutolinkingToSdk52() {
  const srcCandidates = [
    path.join(mobileNm, 'expo', 'node_modules', 'expo-modules-autolinking'),
    path.join(rootNm, 'expo', 'node_modules', 'expo-modules-autolinking'),
  ];
  let src = null;
  for (const candidate of srcCandidates) {
    const version = readPkgVersion(candidate);
    if (version && version.startsWith('2.')) {
      src = candidate;
      break;
    }
  }
  if (!src) {
    fail('expo-modules-autolinking 2.x not found under expo — autolinking may pick a mismatched version.');
  }
  const srcVer = readPkgVersion(src);
  for (const dest of [
    path.join(rootNm, 'expo-modules-autolinking'),
    path.join(mobileNm, 'expo-modules-autolinking'),
  ]) {
    if (path.resolve(dest) === path.resolve(src)) {
      continue;
    }
    const destVer = readPkgVersion(dest);
    if (destVer === srcVer) {
      continue;
    }
    console.log(
      `[eas-pods] pinning expo-modules-autolinking@${srcVer} → ${dest} (was ${destVer ?? 'missing'})`,
    );
    replacePackageTree(src, dest);
  }
}

function pinCommanderForExpoAutolinking() {
  const {
    pinCommanderUnderExpoAutolinking,
  } = require('./pin-expo-autolinking-commander.js');
  pinCommanderUnderExpoAutolinking({
    mobileRoot,
    workspaceRoot,
    installIfMissing: true,
  });
}

function pinReactNativeScreensToSdk52() {
  const mobileScreens = path.join(mobileNm, 'react-native-screens');
  const rootScreens = path.join(rootNm, 'react-native-screens');
  const mobileVer = readPkgVersion(mobileScreens);
  const rootVer = readPkgVersion(rootScreens);
  if (!mobileVer || !mobileVer.startsWith('4.4.')) {
    fail(
      `apps/android-mobile/node_modules/react-native-screens is ${mobileVer ?? 'missing'}, need 4.4.x. ` +
        'A version mismatch here is a known cause of native-stack screens rendering nothing.',
    );
  }
  if (rootVer && !rootVer.startsWith('4.4.')) {
    console.log(
      `[eas-pods] replacing hoisted react-native-screens@${rootVer} with ${mobileVer}`,
    );
    fs.rmSync(rootScreens, { recursive: true, force: true });
    execSync(`cp -R "${mobileScreens}" "${rootScreens}"`, { stdio: 'inherit' });
  }
}

pinReactNativeScreensToSdk52();

const { patchExpoRouterPackage } = require('./patch-expo-router-ctx.js');
const appDir = path.join(mobileRoot, 'app');
for (const dir of [path.join(mobileNm, 'expo-router'), path.join(rootNm, 'expo-router')]) {
  const n = patchExpoRouterPackage(dir, appDir);
  if (n > 0) {
    console.log(`[eas-pods] patched ${n} expo-router ctx file(s) in ${dir}`);
  }
}

const rnPackageJson = resolveMobileReactNativePackageJson();
if (rnPackageJson) {
  console.log(`[eas-pods] mobile React Native is ${readPkgVersion(path.dirname(rnPackageJson))} at ${rnPackageJson}`);
  pinExpoModulesCorePodspecs(rnPackageJson);
} else {
  fail('no React Native 0.76.x found; ExpoModulesCore may pick a hoisted 0.80 peer.');
}

const corePodspec = path.join(mobileNm, 'expo-modules-core', 'ExpoModulesCore.podspec');
console.log(
  `[eas-pods] ExpoModulesCore.podspec ${fs.existsSync(corePodspec) ? 'OK' : 'MISSING'}`
);

// SDK 52 + Xcode 26: exhaustive Calendar.Identifier switch
require('./patch-expo-localization-xcode26.js');

const {
  assertExpoDevLauncherUiScenePatched,
  patchExpoDevLauncherUiScene,
} = require('./patch-expo-dev-launcher-uiscene.js');
const devLauncherPatched = patchExpoDevLauncherUiScene({
  mobileRoot,
  workspaceRoot,
});
if (devLauncherPatched.length > 0) {
  console.log(
    `[eas-pods] deferred Expo Dev Launcher until UIScene window exists:\n  ${devLauncherPatched.join('\n  ')}`,
  );
}
assertExpoDevLauncherUiScenePatched({ mobileRoot, workspaceRoot });

const {
  patchReactNativeXcodeSpacePaths,
} = require('./patch-rn-xcode-space-paths.js');
const spacePathPatched = patchReactNativeXcodeSpacePaths({
  mobileRoot,
  workspaceRoot,
});
if (spacePathPatched.length > 0) {
  console.log(
    `[eas-pods] quoted RN Xcode scripts for paths with spaces:\n  ${spacePathPatched.join('\n  ')}`,
  );
}
