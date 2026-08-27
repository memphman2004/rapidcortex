// Prevent Expo from treating the monorepo root as Metro's workspace root.
// Without this, getWatchFolders() adds the entire root node_modules (1.9GB+)
// plus every workspace package — which hangs bundling locally and on EAS.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const path = require('path');
const { patchExpoRouterPackage } = require('./scripts/patch-expo-router-ctx.js');
const {
  extraNodeModulesForWorkspace,
  resolveSharedPackageModule,
  sharedPackageNodeModuleDir,
  resolveSdk52ScreensDir,
  resolveSdk52ReactNativeDir,
} = require('./scripts/metro-resolve-nested.js');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared');
const appDir = path.join(projectRoot, 'app');

// export:embed always loads this file. Patching here does not depend on
// babel-preset-expo being able to require.resolve('expo-router').
for (const dir of [
  path.join(projectRoot, 'node_modules', 'expo-router'),
  path.join(workspaceRoot, 'node_modules', 'expo-router'),
]) {
  patchExpoRouterPackage(dir, appDir);
}

const config = getDefaultConfig(projectRoot);

// Only crawl mobile + shared. Never crawl root node_modules or sibling apps.
config.watchFolders = [projectRoot, sharedRoot];

// Resolve hoisted deps from the workspace root without watching/crawling it.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Walk node_modules next to the requiring file (e.g. buffer/node_modules/isarray).
// Root isarray is lockfile-dev:true, so EAS `npm ci --omit=dev` drops it; nested
// copies under buffer must still be visible. watchFolders above already prevent
// crawling the whole monorepo — do not disable hierarchical lookup.
// extraNodeModules aliases those polyfills into the project (preferring the
// copy materialized into apps/mobile/node_modules by eas-ensure-expo-pods).
config.resolver.disableHierarchicalLookup = false;
const sdk52Screens = resolveSdk52ScreensDir(projectRoot, workspaceRoot);
const sdk52ReactNative = resolveSdk52ReactNativeDir(projectRoot, workspaceRoot);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...extraNodeModulesForWorkspace(projectRoot, workspaceRoot),
  // Override Expo tsconfig-path mapping to packages/shared/src (breaks .js specifiers).
  'rapid-cortex-shared': sharedPackageNodeModuleDir(sharedRoot),
  // Root hoists react-native-screens@4.26 (RN 0.81 codegen). SDK 52 needs 4.4.0.
  ...(sdk52Screens ? { 'react-native-screens': sdk52Screens } : {}),
  ...(sdk52ReactNative ? { 'react-native': sdk52ReactNative } : {}),
};

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shared = resolveSharedPackageModule(moduleName, sharedRoot);
  if (shared) {
    return shared;
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Watchman hangs on this volume path ("Mac Mini" + large monorepo). Use Node FS crawl.
config.resolver.useWatchman = false;
config.maxWorkers = 2;

config.resolver.blockList = exclusionList([
  new RegExp(
    `${escapeRegExp(workspaceRoot)}[/\\\\]apps[/\\\\](?!mobile(?:[/\\\\]|$)).*`
  ),
  new RegExp(
    `${escapeRegExp(workspaceRoot)}[/\\\\]packages[/\\\\](?!shared(?:[/\\\\]|$)).*`
  ),
  // Shared TS sources use ESM `.js` specifiers Metro cannot rewrite.
  new RegExp(`${escapeRegExp(sharedRoot)}[/\\\\]src[/\\\\].*`),
  new RegExp(`${escapeRegExp(workspaceRoot)}[/\\\\]infra[/\\\\].*`),
  new RegExp(`${escapeRegExp(workspaceRoot)}[/\\\\]scripts[/\\\\].*`),
  new RegExp(`${escapeRegExp(workspaceRoot)}[/\\\\]docs[/\\\\].*`),
]);

module.exports = config;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
