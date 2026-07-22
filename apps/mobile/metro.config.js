// Prevent Expo from treating the monorepo root as Metro's workspace root.
// Without this, getWatchFolders() adds the entire root node_modules (1.9GB+)
// plus every workspace package — which hangs bundling locally and on EAS.
process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

// Only crawl mobile + shared. Never crawl root node_modules or sibling apps.
config.watchFolders = [projectRoot, sharedRoot];

// Resolve hoisted deps from the workspace root without watching/crawling it.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

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
  new RegExp(`${escapeRegExp(workspaceRoot)}[/\\\\]infra[/\\\\].*`),
  new RegExp(`${escapeRegExp(workspaceRoot)}[/\\\\]scripts[/\\\\].*`),
  new RegExp(`${escapeRegExp(workspaceRoot)}[/\\\\]docs[/\\\\].*`),
]);

module.exports = config;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
