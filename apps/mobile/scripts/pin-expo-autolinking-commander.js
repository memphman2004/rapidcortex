/**
 * expo-modules-autolinking 2.0.x (SDK 52) compiles `import commander from 'commander'`
 * to `commander_1.default.command(...)`. That matches commander 7.x, which exports
 * the program instance as module.exports.
 *
 * React Native 0.76 pulls commander 12, which only exports `{ program, Command }`.
 * In an npm workspace that copy can hoist next to Expo (`expo/node_modules/commander`)
 * and shadow 7.x. Xcode's "[Expo] Configure project" then fails with:
 *   TypeError: commander_1.default.command is not a function
 *
 * Nest commander 7.x inside every expo-modules-autolinking tree so Node resolves
 * it before any hoisted 12.x.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const COMMANDER_7 = '7.2.0';

function readPkgVersion(pkgDir) {
  const pkg = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkg)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  } catch {
    return null;
  }
}

function isCommander7(version) {
  return Boolean(version && String(version).startsWith('7.'));
}

/**
 * @param {string[]} nodeModulesRoots
 * @returns {string | null}
 */
function findCommander7(nodeModulesRoots) {
  const candidates = [];
  for (const root of nodeModulesRoots) {
    candidates.push(
      path.join(root, 'commander'),
      path.join(root, 'expo-modules-autolinking', 'node_modules', 'commander'),
      path.join(root, 'expo', 'node_modules', 'expo-modules-autolinking', 'node_modules', 'commander'),
    );
  }
  for (const dir of candidates) {
    if (isCommander7(readPkgVersion(dir))) {
      return dir;
    }
  }
  return null;
}

/**
 * @param {string[]} nodeModulesRoots
 * @returns {string[]}
 */
function autolinkingPackageDirs(nodeModulesRoots) {
  const dirs = [];
  for (const root of nodeModulesRoots) {
    dirs.push(
      path.join(root, 'expo', 'node_modules', 'expo-modules-autolinking'),
      path.join(root, 'expo-modules-autolinking'),
    );
  }
  return dirs;
}

function copyTree(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

/**
 * Download commander 7.2.0 via npm pack when no 7.x tree is already installed.
 * @returns {string} extracted package directory (caller must delete parent tmp)
 */
function packCommander7() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-commander7-'));
  execSync(`npm pack commander@${COMMANDER_7} --pack-destination "${tmp}"`, {
    stdio: 'inherit',
  });
  const tgz = fs.readdirSync(tmp).find((name) => name.startsWith('commander-'));
  if (!tgz) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`[eas-pods] npm pack commander@${COMMANDER_7} produced no tarball`);
  }
  execSync(`tar -xzf "${tgz}"`, { cwd: tmp, stdio: 'inherit' });
  const extracted = path.join(tmp, 'package');
  if (!fs.existsSync(extracted)) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error('[eas-pods] commander pack extract missing package/');
  }
  return extracted;
}

/**
 * @param {{ mobileRoot: string, workspaceRoot: string, installIfMissing?: boolean }} opts
 * @returns {{ pinned: string[], skipped: string[], sourceVersion: string | null }}
 */
function pinCommanderUnderExpoAutolinking(opts) {
  const mobileNm = path.join(opts.mobileRoot, 'node_modules');
  const rootNm = path.join(opts.workspaceRoot, 'node_modules');
  const roots = [mobileNm, rootNm];

  let src = findCommander7(roots);
  let packedTmpParent = null;
  if (!src && opts.installIfMissing) {
    console.log(`[eas-pods] commander 7.x not in tree; packing commander@${COMMANDER_7}`);
    src = packCommander7();
    packedTmpParent = path.dirname(src);
  }

  const result = { pinned: [], skipped: [], sourceVersion: src ? readPkgVersion(src) : null };
  if (!src) {
    console.warn(
      '[eas-pods] commander 7.x not found; expo-modules-autolinking may fail Configure project',
    );
    return result;
  }

  try {
    for (const autolinkingDir of autolinkingPackageDirs(roots)) {
      if (!fs.existsSync(path.join(autolinkingDir, 'package.json'))) {
        continue;
      }
      const dest = path.join(autolinkingDir, 'node_modules', 'commander');
      const destVer = readPkgVersion(dest);
      if (isCommander7(destVer)) {
        result.skipped.push(autolinkingDir);
        continue;
      }
      console.log(
        `[eas-pods] pinning commander@${result.sourceVersion} under ${autolinkingDir} (was ${destVer ?? 'missing'})`,
      );
      copyTree(src, dest);
      result.pinned.push(autolinkingDir);
    }
  } finally {
    if (packedTmpParent) {
      fs.rmSync(packedTmpParent, { recursive: true, force: true });
    }
  }

  return result;
}

module.exports = {
  COMMANDER_7,
  readPkgVersion,
  isCommander7,
  findCommander7,
  autolinkingPackageDirs,
  pinCommanderUnderExpoAutolinking,
};
