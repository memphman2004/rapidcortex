/**
 * EAS installs npm workspaces with Expo hoisted to the monorepo root.
 * CocoaPods (from apps/mobile/ios) only looks in apps/mobile/node_modules,
 * so ExpoModulesCore / Expo* pods go missing. Materialize them locally.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mobileRoot = process.cwd();
const workspaceRoot = path.resolve(mobileRoot, '../..');
const mobileNm = path.join(mobileRoot, 'node_modules');
const rootNm = path.join(workspaceRoot, 'node_modules');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function materialize(pkg) {
  const dest = path.join(mobileNm, pkg);
  const src = path.join(rootNm, pkg);
  if (fs.existsSync(dest)) {
    console.log(`[eas-pods] ${pkg} already present at ${dest}`);
    return;
  }
  if (!fs.existsSync(src)) {
    console.warn(`[eas-pods] missing source ${src}`);
    return;
  }
  ensureDir(mobileNm);
  console.log(`[eas-pods] copying ${pkg} → apps/mobile/node_modules`);
  execSync(`cp -R "${src}" "${dest}"`, { stdio: 'inherit' });
}

ensureDir(mobileNm);
for (const pkg of ['expo', 'expo-modules-core']) {
  materialize(pkg);
}

const corePodspec = path.join(mobileNm, 'expo-modules-core', 'ExpoModulesCore.podspec');
console.log(
  `[eas-pods] ExpoModulesCore.podspec ${fs.existsSync(corePodspec) ? 'OK' : 'MISSING'}`
);

// SDK 52 + Xcode 26: exhaustive Calendar.Identifier switch
require('./patch-expo-localization-xcode26.js');
