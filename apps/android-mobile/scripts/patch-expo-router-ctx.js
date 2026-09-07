/**
 * Metro's require.context() needs a string literal directory. expo-router's
 * `_ctx.*.js` files pass `process.env.EXPO_ROUTER_APP_ROOT`, which babel-preset-expo
 * only inlines when `require.resolve('expo-router')` works from the preset's
 * (often hoisted) location. Patch the files so EAS `export:embed` does not depend
 * on that resolve.
 */

const fs = require('fs');
const path = require('path');

const CTX_FILES = [
  '_ctx.js',
  '_ctx.ios.js',
  '_ctx.android.js',
  '_ctx.web.js',
  '_ctx-html.js',
];

/**
 * @param {string} source
 * @param {string} relAppRoot posix-style path from the expo-router package dir
 * @param {string} [importMode]
 * @returns {string}
 */
function rewriteExpoRouterCtxSource(source, relAppRoot, importMode = 'sync') {
  return source
    .replace(/process\.env\.EXPO_ROUTER_APP_ROOT/g, JSON.stringify(relAppRoot))
    .replace(/process\.env\.EXPO_ROUTER_IMPORT_MODE/g, JSON.stringify(importMode));
}

/**
 * @param {string} expoRouterDir
 * @param {string} appDir
 * @returns {number} files written
 */
function patchExpoRouterPackage(expoRouterDir, appDir) {
  if (!fs.existsSync(expoRouterDir) || !fs.existsSync(appDir)) {
    return 0;
  }
  const relAppRoot = path.relative(expoRouterDir, appDir).replace(/\\/g, '/');
  let written = 0;
  for (const file of CTX_FILES) {
    const filePath = path.join(expoRouterDir, file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const before = fs.readFileSync(filePath, 'utf8');
    const after = rewriteExpoRouterCtxSource(before, relAppRoot);
    if (after !== before) {
      fs.writeFileSync(filePath, after);
      written += 1;
    }
  }
  return written;
}

module.exports = {
  CTX_FILES,
  rewriteExpoRouterCtxSource,
  patchExpoRouterPackage,
};
