/**
 * Prebuild-time pin so ExpoModulesCore.podspec does not resolve a hoisted
 * React Native 0.80.x peer at the workspace root (ReactAppDependencyProvider).
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const {
  isPinnedMobileReactNative,
  patchExpoModulesCorePodspec,
} = require('../scripts/pin-expo-modules-core-rn.js');

function readVersion(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
}

function findPinnedReactNativePackageJson(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules', 'react-native', 'package.json'),
    path.join(projectRoot, '..', '..', 'node_modules', 'react-native', 'package.json'),
  ];
  for (const packageJsonPath of candidates) {
    const version = readVersion(packageJsonPath);
    if (version && isPinnedMobileReactNative(version)) {
      return packageJsonPath;
    }
  }
  return null;
}

function withPinExpoModulesCoreRn(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const rnPackageJson = findPinnedReactNativePackageJson(projectRoot);
      if (!rnPackageJson) {
        return cfg;
      }

      const workspaceRoot = path.resolve(projectRoot, '../..');
      const podspecs = [
        path.join(projectRoot, 'node_modules', 'expo-modules-core', 'ExpoModulesCore.podspec'),
        path.join(workspaceRoot, 'node_modules', 'expo-modules-core', 'ExpoModulesCore.podspec'),
      ];
      for (const podspecPath of podspecs) {
        if (!fs.existsSync(podspecPath)) {
          continue;
        }
        const before = fs.readFileSync(podspecPath, 'utf8');
        const after = patchExpoModulesCorePodspec(before, rnPackageJson);
        if (after !== before) {
          fs.writeFileSync(podspecPath, after);
        }
      }
      return cfg;
    },
  ]);
}

module.exports = withPinExpoModulesCoreRn;
