/**
 * EAS uploads a slim monorepo via .easignore. That can leave empty
 * apps/ and packages/ workspace directories whose package.json was excluded.
 * npm ci then fails (often with a misleading "no package-lock.json" EUSAGE).
 * Remove those empty workspace shells before install.
 */
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../../..');

function isEffectivelyEmptyDir(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  if (fs.existsSync(path.join(dir, 'package.json'))) return false;
  const entries = fs.readdirSync(dir);
  return entries.every((name) => {
    const full = path.join(dir, name);
    try {
      return fs.statSync(full).isDirectory() && isEffectivelyEmptyDir(full);
    } catch {
      return false;
    }
  });
}

function prune(parentRel) {
  const parent = path.join(workspaceRoot, parentRel);
  if (!fs.existsSync(parent)) return;
  for (const name of fs.readdirSync(parent)) {
    const full = path.join(parent, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (isEffectivelyEmptyDir(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`[eas-pre-install] removed empty workspace dir ${parentRel}/${name}`);
    }
  }
}

prune('apps');
prune('packages');
console.log('[eas-pre-install] workspace prune complete');
