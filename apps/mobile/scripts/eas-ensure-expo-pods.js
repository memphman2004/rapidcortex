/**
 * EAS installs npm workspaces with Expo hoisted to the monorepo root.
 * CocoaPods (from apps/mobile/ios) only looks in apps/mobile/node_modules,
 * so ExpoModulesCore / Expo* pods go missing. Materialize them locally.
 *
 * Also pin ExpoModulesCore's React Native version probe to the mobile app's
 * 0.76.9 — a hoisted RN 0.80 peer at the repo root makes pod install fail
 * looking for ReactAppDependencyProvider.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  isSdk52ReactNative,
  patchExpoModulesCorePodspec,
} = require('./pin-expo-modules-core-rn.js');

const mobileRoot = process.cwd();
const workspaceRoot = path.resolve(mobileRoot, '../..');
const mobileNm = path.join(mobileRoot, 'node_modules');
const rootNm = path.join(workspaceRoot, 'node_modules');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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
  console.log(`[eas-pods] copying ${pkg} → apps/mobile/node_modules`);
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
      console.warn(`[eas-pods] did not patch ${podspecPath} (pattern mismatch)`);
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

const rnPackageJson = resolveMobileReactNativePackageJson();
if (rnPackageJson) {
  console.log(`[eas-pods] mobile React Native is ${readPkgVersion(path.dirname(rnPackageJson))} at ${rnPackageJson}`);
  pinExpoModulesCorePodspecs(rnPackageJson);
} else {
  console.warn('[eas-pods] no React Native 0.76.x found; ExpoModulesCore may pick a hoisted 0.80 peer');
}

const corePodspec = path.join(mobileNm, 'expo-modules-core', 'ExpoModulesCore.podspec');
console.log(
  `[eas-pods] ExpoModulesCore.podspec ${fs.existsSync(corePodspec) ? 'OK' : 'MISSING'}`
);

// SDK 52 + Xcode 26: exhaustive Calendar.Identifier switch
require('./patch-expo-localization-xcode26.js');
