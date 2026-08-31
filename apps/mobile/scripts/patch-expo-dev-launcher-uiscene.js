/**
 * Expo Dev Launcher (SDK 52) fatals in didFinishLaunching when there is no
 * key window. UIScene creates the window in scene:willConnectToSession,
 * which runs after that method — so Debug + UIScene dies on:
 *   "Cannot find the keyWindow. Make sure to call window.makeKeyAndVisible()."
 *
 * Defer autoSetupStart; AppDelegate starts the launcher after the scene window
 * exists and viewWithModuleName has called autoSetupPrepare.
 *
 * Match on the fatal string (regex), not an exact 6-line needle. EAS 34 missed
 * because whitespace / quote drift made the exact block not match.
 */
const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'RAPID_CORTEX_UISCENE_DEV_LAUNCHER';

const UNQUOTED_FINISH_LAUNCHING =
  '  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {\n' +
  '    guard let window = UIApplication.shared.delegate?.window ?? UIApplication.shared.windows.filter { $0.isKeyWindow }.first else {\n' +
  '      fatalError("Cannot find the keyWindow. Make sure to call `window.makeKeyAndVisible()`.")\n' +
  '    }\n' +
  '    EXDevLauncherController.sharedInstance().autoSetupStart(window)\n' +
  '    return false\n' +
  '  }';

const QUOTED_FINISH_LAUNCHING =
  '  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {\n' +
  '    // ' +
  MARKER +
  ': UIScene creates the window after didFinishLaunching.\n' +
  '    // autoSetupStart runs from AppDelegate once the scene window exists.\n' +
  '    return false\n' +
  '  }';

const UNQUOTED_GET_WINDOW =
  '  private func getWindow() -> UIWindow {\n' +
  '    guard let window = UIApplication.shared.windows.filter(\\.isKeyWindow).first ?? UIApplication.shared.delegate?.window as? UIWindow else {\n' +
  '      fatalError("Cannot find the current window.")\n' +
  '    }\n' +
  '    return window\n' +
  '  }';

const QUOTED_GET_WINDOW =
  '  private func getWindow() -> UIWindow {\n' +
  '    if let window = UIApplication.shared.delegate?.window as? UIWindow {\n' +
  '      return window\n' +
  '    }\n' +
  '    if let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) {\n' +
  '      return window\n' +
  '    }\n' +
  '    let sceneWindows = UIApplication.shared.connectedScenes\n' +
  '      .compactMap { $0 as? UIWindowScene }\n' +
  '      .flatMap { $0.windows }\n' +
  '    if let window = sceneWindows.first(where: { $0.isKeyWindow }) ?? sceneWindows.first {\n' +
  '      return window\n' +
  '    }\n' +
  '    fatalError("Cannot find the current window.")\n' +
  '  }';

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchDevLauncherSubscriber(contents) {
  if (contents.includes(MARKER)) {
    return { contents, changed: false };
  }
  if (contents.includes(UNQUOTED_FINISH_LAUNCHING)) {
    return {
      contents: contents.split(UNQUOTED_FINISH_LAUNCHING).join(QUOTED_FINISH_LAUNCHING),
      changed: true,
    };
  }
  if (!contents.includes('Cannot find the keyWindow')) {
    return { contents, changed: false };
  }
  const byMethod = contents.replace(
    /public func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions:[\s\S]*?return false\s*\n\s*\}/,
    QUOTED_FINISH_LAUNCHING.trim(),
  );
  if (byMethod !== contents) {
    return { contents: byMethod, changed: true };
  }
  const byFatal = contents.replace(
    /fatalError\(\s*"Cannot find the keyWindow[\s\S]*?"\s*\)/,
    `return false /* ${MARKER} */`,
  );
  return { contents: byFatal, changed: byFatal !== contents };
}

/**
 * @param {string} contents
 * @returns {{ contents: string, changed: boolean }}
 */
function patchDevLauncherGetWindow(contents) {
  if (contents.includes('connectedScenes') && contents.includes('UIWindowScene')) {
    return { contents, changed: false };
  }
  if (contents.includes(UNQUOTED_GET_WINDOW)) {
    return {
      contents: contents.split(UNQUOTED_GET_WINDOW).join(QUOTED_GET_WINDOW),
      changed: true,
    };
  }
  if (!contents.includes('Cannot find the current window')) {
    return { contents, changed: false };
  }
  const next = contents.replace(
    /private func getWindow\(\) -> UIWindow \{[\s\S]*?\n  \}/,
    QUOTED_GET_WINDOW.trim(),
  );
  return { contents: next, changed: next !== contents };
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
 * @param {{ mobileRoot?: string, workspaceRoot?: string }} dirs
 * @returns {string[]}
 */
function collectDevLauncherRoots({ mobileRoot, workspaceRoot } = {}) {
  const roots = [];
  const seen = new Set();
  const add = (dir) => {
    if (!dir || !fs.existsSync(dir)) {
      return;
    }
    const resolved = fs.realpathSync(dir);
    if (seen.has(resolved)) {
      return;
    }
    seen.add(resolved);
    roots.push(resolved);
  };
  for (const base of [mobileRoot, workspaceRoot].filter(Boolean)) {
    try {
      add(
        path.dirname(
          require.resolve('expo-dev-launcher/package.json', { paths: [base] }),
        ),
      );
    } catch {
      add(path.join(base, 'node_modules', 'expo-dev-launcher'));
    }
  }
  return roots;
}

/**
 * @param {{ mobileRoot: string, workspaceRoot?: string }} dirs
 * @returns {string[]}
 */
function patchExpoDevLauncherUiScene({ mobileRoot, workspaceRoot }) {
  const patched = [];
  for (const root of collectDevLauncherRoots({ mobileRoot, workspaceRoot })) {
    const subscriber = path.join(
      root,
      'ios/ReactDelegateHandler/ExpoDevLauncherAppDelegateSubscriber.swift',
    );
    if (patchFile(subscriber, patchDevLauncherSubscriber)) {
      patched.push(subscriber);
    } else if (fs.existsSync(subscriber)) {
      const raw = fs.readFileSync(subscriber, 'utf8');
      if (raw.includes(MARKER)) {
        console.log(`[uiscene] Dev Launcher subscriber already deferred: ${subscriber}`);
      } else if (raw.includes('Cannot find the keyWindow')) {
        console.warn(
          `[uiscene] Dev Launcher subscriber still fatals on keyWindow: ${subscriber}`,
        );
      }
    } else {
      console.warn(`[uiscene] missing Dev Launcher subscriber at ${subscriber}`);
    }

    const handler = path.join(
      root,
      'ios/ReactDelegateHandler/ExpoDevLauncherReactDelegateHandler.swift',
    );
    if (patchFile(handler, patchDevLauncherGetWindow)) {
      patched.push(handler);
    }
  }
  return patched;
}

/**
 * EAS 34 shipped because a needle miss was silent. Fail if the keyWindow
 * fatal is still in source after the patcher runs.
 *
 * @param {{ mobileRoot: string, workspaceRoot?: string }} dirs
 */
function assertExpoDevLauncherUiScenePatched({ mobileRoot, workspaceRoot }) {
  const roots = collectDevLauncherRoots({ mobileRoot, workspaceRoot });
  if (roots.length === 0) {
    throw new Error(
      '[eas-pods] expo-dev-launcher not found — cannot patch the UIScene keyWindow fatal',
    );
  }
  for (const root of roots) {
    const subscriber = path.join(
      root,
      'ios/ReactDelegateHandler/ExpoDevLauncherAppDelegateSubscriber.swift',
    );
    if (!fs.existsSync(subscriber)) {
      throw new Error(`[eas-pods] missing ${subscriber}`);
    }
    const contents = fs.readFileSync(subscriber, 'utf8');
    if (contents.includes('Cannot find the keyWindow') && !contents.includes(MARKER)) {
      throw new Error(
        `[eas-pods] ${subscriber} still fatals on keyWindow. Store builds must not ship this.`,
      );
    }
  }
}

module.exports = {
  MARKER,
  UNQUOTED_FINISH_LAUNCHING,
  QUOTED_FINISH_LAUNCHING,
  UNQUOTED_GET_WINDOW,
  QUOTED_GET_WINDOW,
  patchDevLauncherSubscriber,
  patchDevLauncherGetWindow,
  collectDevLauncherRoots,
  patchExpoDevLauncherUiScene,
  assertExpoDevLauncherUiScenePatched,
};
