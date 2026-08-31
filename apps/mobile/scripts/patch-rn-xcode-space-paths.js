/**
 * React Native 0.76 codegen runs:
 *   /bin/sh -c "$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT"
 * and with-environment.sh then executes `$1` unquoted.
 *
 * Expo Constants runs:
 *   bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"
 * which bash -c then splits on spaces.
 *
 * Expo's "Bundle React Native code and images" phase runs the path to
 * react-native-xcode.sh via unquoted backticks, so the same split happens
 * on the app target (Script-00DD… line 40: `/Volumes/Mac: No such file`).
 *
 * Repo paths with spaces (e.g. `/Volumes/Mac Mini/Coding Projects/...`)
 * become `/Volumes/Mac` → Xcode "Command PhaseScriptExecution failed"
 * on ReactCodegen, EXConstants, and Bundle React Native.
 */
const fs = require('node:fs');
const path = require('node:path');

const UNQUOTED_CODEGEN =
  '/bin/sh -c "$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT"';
const QUOTED_CODEGEN =
  '/bin/bash "$WITH_ENVIRONMENT" "$SCRIPT_PHASES_SCRIPT"';

const UNQUOTED_INVOKE = '\n  $1\n';
const QUOTED_INVOKE = '\n  "$@"\n';

const UNQUOTED_EXCONSTANTS =
  'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"';
const QUOTED_EXCONSTANTS =
  'bash -l "$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"';

const UNQUOTED_EXCONSTANTS_PBX =
  'bash -l -c \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"';
const QUOTED_EXCONSTANTS_PBX =
  'bash -l \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"';

const UNQUOTED_BASENAME = 'PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)';
const QUOTED_BASENAME = 'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")';

const NODE_PRINT_RN_XCODE =
  '"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"';
const NODE_PRINT_RN_XCODE_PBX =
  '\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"';

/** Raw shell (Xcode Script-*.sh, tests, xcode npm if it unescapes). */
const UNQUOTED_BUNDLE_RN = '`' + NODE_PRINT_RN_XCODE + '`';
const QUOTED_BUNDLE_RN =
  'REACT_NATIVE_XCODE="$(' + NODE_PRINT_RN_XCODE + ')"\n/bin/sh "$REACT_NATIVE_XCODE"';

/** pbxproj stores the same line with escaped double quotes. */
const UNQUOTED_BUNDLE_RN_PBX = '`' + NODE_PRINT_RN_XCODE_PBX + '`';
const QUOTED_BUNDLE_RN_PBX =
  'REACT_NATIVE_XCODE=\\"$(' +
  NODE_PRINT_RN_XCODE_PBX +
  ')\\"\\n/bin/sh \\"$REACT_NATIVE_XCODE\\"';

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchScriptPhasesRb(contents) {
  if (!contents.includes(UNQUOTED_CODEGEN)) {
    return { contents, changed: false };
  }
  return {
    contents: contents.split(UNQUOTED_CODEGEN).join(QUOTED_CODEGEN),
    changed: true,
  };
}

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchWithEnvironmentSh(contents) {
  if (contents.includes(QUOTED_INVOKE) && !contents.includes(UNQUOTED_INVOKE)) {
    return { contents, changed: false };
  }
  if (!contents.includes(UNQUOTED_INVOKE)) {
    return { contents, changed: false };
  }
  return {
    contents: contents.split(UNQUOTED_INVOKE).join(QUOTED_INVOKE),
    changed: true,
  };
}

/**
 * CocoaPods stores the script with escaped quotes in project.pbxproj.
 * @param {string} contents
 */
function patchPodsPbxproj(contents) {
  let next = contents;
  let changed = false;
  const from =
    '/bin/sh -c \\"$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT\\"';
  const to =
    '/bin/bash \\"$WITH_ENVIRONMENT\\" \\"$SCRIPT_PHASES_SCRIPT\\"';
  if (next.includes(from)) {
    next = next.split(from).join(to);
    changed = true;
  }
  if (next.includes(UNQUOTED_EXCONSTANTS_PBX)) {
    next = next.split(UNQUOTED_EXCONSTANTS_PBX).join(QUOTED_EXCONSTANTS_PBX);
    changed = true;
  }
  return { contents: next, changed };
}

/**
 * @param {string} contents
 */
function patchExConstantsScript(contents) {
  if (!contents.includes(UNQUOTED_EXCONSTANTS)) {
    return { contents, changed: false };
  }
  return {
    contents: contents.split(UNQUOTED_EXCONSTANTS).join(QUOTED_EXCONSTANTS),
    changed: true,
  };
}

/**
 * `basename $PROJECT_DIR` splits `/Volumes/Mac Mini/.../Pods` and the script
 * exits 0 as if this were a classic (non-Pods) Xcode project.
 * @param {string} contents
 */
function patchGetAppConfigIosSh(contents) {
  if (!contents.includes(UNQUOTED_BASENAME)) {
    return { contents, changed: false };
  }
  return {
    contents: contents.split(UNQUOTED_BASENAME).join(QUOTED_BASENAME),
    changed: true,
  };
}

/**
 * Quote the Expo "Bundle React Native code and images" invocation so
 * `/Volumes/Mac Mini/.../react-native-xcode.sh` is not executed as `/Volumes/Mac`.
 * Handles raw shell and pbxproj-escaped forms.
 * @param {string} contents
 */
function patchBundleReactNativeScript(contents) {
  let next = contents;
  let changed = false;
  if (next.includes(UNQUOTED_BUNDLE_RN_PBX)) {
    next = next.split(UNQUOTED_BUNDLE_RN_PBX).join(QUOTED_BUNDLE_RN_PBX);
    changed = true;
  }
  if (next.includes(UNQUOTED_BUNDLE_RN)) {
    next = next.split(UNQUOTED_BUNDLE_RN).join(QUOTED_BUNDLE_RN);
    changed = true;
  }
  return { contents: next, changed };
}

/**
 * @param {string} filePath
 * @param {(contents: string) => { contents: string, changed: boolean }} patcher
 */
function patchFile(filePath, patcher) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const { contents, changed } = patcher(original);
  if (!changed) {
    return false;
  }
  fs.writeFileSync(filePath, contents);
  return true;
}

/**
 * @param {{ mobileRoot: string, workspaceRoot?: string }} dirs
 * @returns {string[]} patched file paths
 */
function patchReactNativeXcodeSpacePaths({ mobileRoot, workspaceRoot }) {
  const patched = [];
  const rnRoots = [
    path.join(mobileRoot, 'node_modules', 'react-native'),
  ];
  if (workspaceRoot) {
    rnRoots.push(path.join(workspaceRoot, 'node_modules', 'react-native'));
  }

  const seen = new Set();
  for (const rn of rnRoots) {
    const resolved = fs.existsSync(rn) ? fs.realpathSync(rn) : rn;
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    const rb = path.join(rn, 'scripts/react_native_pods_utils/script_phases.rb');
    if (patchFile(rb, patchScriptPhasesRb)) patched.push(rb);

    const sh = path.join(rn, 'scripts/xcode/with-environment.sh');
    if (patchFile(sh, patchWithEnvironmentSh)) patched.push(sh);
  }

  const pbx = path.join(
    mobileRoot,
    'ios/Pods/Pods.xcodeproj/project.pbxproj',
  );
  if (patchFile(pbx, patchPodsPbxproj)) patched.push(pbx);

  const appPbx = path.join(
    mobileRoot,
    'ios/RapidCortex.xcodeproj/project.pbxproj',
  );
  if (patchFile(appPbx, patchBundleReactNativeScript)) patched.push(appPbx);

  const expoRoots = [
    path.join(mobileRoot, 'node_modules', 'expo-constants'),
  ];
  if (workspaceRoot) {
    expoRoots.push(path.join(workspaceRoot, 'node_modules', 'expo-constants'));
  }
  const seenExpo = new Set();
  for (const expo of expoRoots) {
    const resolved = fs.existsSync(expo) ? fs.realpathSync(expo) : expo;
    if (seenExpo.has(resolved)) continue;
    seenExpo.add(resolved);

    const podspec = path.join(resolved, 'ios/EXConstants.podspec');
    if (patchFile(podspec, patchExConstantsScript)) patched.push(podspec);

    const sh = path.join(resolved, 'scripts/get-app-config-ios.sh');
    if (patchFile(sh, patchGetAppConfigIosSh)) patched.push(sh);
  }

  return patched;
}

module.exports = {
  UNQUOTED_CODEGEN,
  QUOTED_CODEGEN,
  UNQUOTED_EXCONSTANTS,
  QUOTED_EXCONSTANTS,
  UNQUOTED_BUNDLE_RN,
  QUOTED_BUNDLE_RN,
  UNQUOTED_BUNDLE_RN_PBX,
  QUOTED_BUNDLE_RN_PBX,
  patchScriptPhasesRb,
  patchWithEnvironmentSh,
  patchPodsPbxproj,
  patchExConstantsScript,
  patchGetAppConfigIosSh,
  patchBundleReactNativeScript,
  patchReactNativeXcodeSpacePaths,
};
