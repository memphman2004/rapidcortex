/**
 * Metro with disableHierarchicalLookup cannot see nested installs such as
 * node_modules/buffer/node_modules/isarray. On EAS, root isarray is also
 * omitted because the lockfile marks it dev:true.
 *
 * extraNodeModules must point inside apps/android-mobile when possible: Metro's
 * watchFolders are only mobile + packages/shared, so a mapping into the
 * workspace root node_modules can still fail resolution on EAS.
 */

const fs = require('fs');
const path = require('path');

const NESTED_POLYFILLS = ['isarray', 'ieee754', 'base64-js'];

/**
 * Prefer buffer's nested copy (isarray@1) over a hoisted lockfile-dev isarray@2.
 * @param {string} projectRoot
 * @param {string} workspaceRoot
 * @returns {string[]}
 */
function nestedPolyfillSearchFrom(projectRoot, workspaceRoot) {
  return [
    path.join(workspaceRoot, 'node_modules', 'buffer'),
    path.join(projectRoot, 'node_modules', 'buffer'),
    path.join(projectRoot, 'node_modules'),
    path.join(workspaceRoot, 'node_modules'),
  ];
}

/**
 * @param {string} name
 * @param {string[]} searchFrom directories passed to require.resolve `{ paths }`
 * @returns {string | null} package directory
 */
function resolvePackageDir(name, searchFrom) {
  for (const from of searchFrom) {
    try {
      return path.dirname(
        require.resolve(`${name}/package.json`, { paths: [from] }),
      );
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Copy buffer's nested polyfills into apps/android-mobile/node_modules (and the
 * workspace root if missing) so Metro can resolve them after `npm ci --omit=dev`.
 *
 * @param {string} projectRoot apps/android-mobile
 * @param {string} workspaceRoot monorepo root
 * @returns {string[]} destinations written
 */
function materializeNestedPolyfills(projectRoot, workspaceRoot) {
  const mobileNm = path.join(projectRoot, 'node_modules');
  const rootNm = path.join(workspaceRoot, 'node_modules');
  const searchFrom = nestedPolyfillSearchFrom(projectRoot, workspaceRoot);
  /** @type {string[]} */
  const copied = [];

  for (const name of NESTED_POLYFILLS) {
    const src = resolvePackageDir(name, searchFrom);
    if (!src) {
      continue;
    }
    for (const dest of [path.join(mobileNm, name), path.join(rootNm, name)]) {
      if (fs.existsSync(path.join(dest, 'package.json'))) {
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      copied.push(dest);
    }
  }
  return copied;
}

/**
 * @param {string} projectRoot apps/android-mobile
 * @param {string} workspaceRoot monorepo root
 * @returns {Record<string, string>}
 */
function extraNodeModulesForWorkspace(projectRoot, workspaceRoot) {
  const searchFrom = [
    path.join(projectRoot, 'node_modules'),
    ...nestedPolyfillSearchFrom(projectRoot, workspaceRoot),
  ];
  /** @type {Record<string, string>} */
  const extra = {};
  for (const name of NESTED_POLYFILLS) {
    const dir = resolvePackageDir(name, searchFrom);
    if (dir) {
      extra[name] = dir;
    }
  }
  return extra;
}

function readPackageVersion(pkgDir) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'),
    ).version;
  } catch {
    return null;
  }
}

/**
 * Prefer the SDK 52 nested install (4.4.x) over a hoisted peer such as 4.26.x
 * that requires RN 0.81 Fabric codegen.
 *
 * @param {string} projectRoot
 * @param {string} workspaceRoot
 * @returns {string | null}
 */
function resolveSdk52ScreensDir(projectRoot, workspaceRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules', 'react-native-screens'),
    path.join(workspaceRoot, 'node_modules', 'react-native-screens'),
  ];
  for (const dir of candidates) {
    const version = readPackageVersion(dir);
    if (version && version.startsWith('4.4.')) {
      return dir;
    }
  }
  return null;
}

/**
 * @param {string} projectRoot
 * @param {string} workspaceRoot
 * @returns {string | null}
 */
function resolveSdk52ReactNativeDir(projectRoot, workspaceRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules', 'react-native'),
    path.join(workspaceRoot, 'node_modules', 'react-native'),
  ];
  for (const dir of candidates) {
    const version = readPackageVersion(dir);
    if (version && version.startsWith('0.76.')) {
      return dir;
    }
  }
  return null;
}

function sameRealpath(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return path.resolve(a) === path.resolve(b);
  }
}

/**
 * Metro will evaluate BatchedBridge.js once per physical react-native copy.
 * A second copy overwrites global.__fbBatchedBridge with an empty MessageQueue,
 * and Android then calls AppRegistry.runApplication on n=0 callable modules.
 *
 * @param {string | null} chosenDir
 * @param {string} projectRoot
 * @param {string} workspaceRoot
 * @returns {string[]}
 */
function duplicateReactNativeDirs(chosenDir, projectRoot, workspaceRoot) {
  if (!chosenDir) {
    return [];
  }
  const candidates = [
    path.join(projectRoot, 'node_modules', 'react-native'),
    path.join(workspaceRoot, 'node_modules', 'react-native'),
  ];
  /** @type {string[]} */
  const extras = [];
  for (const dir of candidates) {
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      continue;
    }
    if (sameRealpath(dir, chosenDir)) {
      continue;
    }
    extras.push(dir);
  }
  return extras;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string | null} chosenDir
 * @param {string} projectRoot
 * @param {string} workspaceRoot
 * @returns {RegExp[]}
 */
function duplicateReactNativeBlockList(chosenDir, projectRoot, workspaceRoot) {
  return duplicateReactNativeDirs(chosenDir, projectRoot, workspaceRoot).map(
    (dir) => new RegExp(`${escapeRegExp(dir)}[/\\\\].*`),
  );
}

/**
 * Force every `react-native` / `react-native/...` import onto the SDK 52 tree.
 *
 * @param {string} moduleName
 * @param {string | null} rnDir
 * @returns {{ type: 'sourceFile', filePath: string } | null}
 */
function resolveReactNativeModule(moduleName, rnDir) {
  if (!rnDir) {
    return null;
  }
  if (moduleName !== 'react-native' && !moduleName.startsWith('react-native/')) {
    return null;
  }
  try {
    const filePath =
      moduleName === 'react-native'
        ? require.resolve(rnDir)
        : require.resolve(path.join(rnDir, moduleName.slice('react-native/'.length)));
    return { type: 'sourceFile', filePath };
  } catch {
    return null;
  }
}

/**
 * Expo Metro applies tsconfig paths, which map `rapid-cortex-shared` to
 * packages/shared/src/index.ts. That file uses TypeScript ESM `.js` specifiers
 * (`./constants.js`) that Metro will not rewrite to `.ts`. Point the bundle at
 * the compiled dist instead.
 *
 * @param {string} moduleName
 * @param {string} sharedRoot packages/shared
 * @returns {{ type: 'sourceFile', filePath: string } | null}
 */
function resolveSharedPackageModule(moduleName, sharedRoot) {
  if (moduleName !== 'rapid-cortex-shared') {
    return null;
  }
  const distIndex = path.join(sharedRoot, 'dist', 'index.js');
  if (!fs.existsSync(distIndex)) {
    return null;
  }
  return { type: 'sourceFile', filePath: distIndex };
}

/**
 * @param {string} sharedRoot
 * @returns {string} directory Metro should treat as the package
 */
function sharedPackageNodeModuleDir(sharedRoot) {
  const distIndex = path.join(sharedRoot, 'dist', 'index.js');
  return fs.existsSync(distIndex) ? path.join(sharedRoot, 'dist') : sharedRoot;
}

module.exports = {
  NESTED_POLYFILLS,
  resolvePackageDir,
  nestedPolyfillSearchFrom,
  materializeNestedPolyfills,
  extraNodeModulesForWorkspace,
  resolveSharedPackageModule,
  sharedPackageNodeModuleDir,
  readPackageVersion,
  resolveSdk52ScreensDir,
  resolveSdk52ReactNativeDir,
  duplicateReactNativeDirs,
  duplicateReactNativeBlockList,
  resolveReactNativeModule,
};
