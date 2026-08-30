/**
 * Xcode 26 / iOS 26 SDK (ITMS-90725 image) requires the UIScene lifecycle.
 * Expo SDK 52 still generates AppDelegate.mm that creates UIWindow with
 * `[UIScreen mainScreen].bounds` and ships no UIApplicationSceneManifest.
 * Apple then logs: "'UIScene' life cycle is now required ... Apps that
 * don't adopt will fail to launch." and the process never paints (TestFlight 27).
 *
 * UISceneDelegateClassName must be a dedicated SceneDelegate — not AppDelegate.
 * UIKit instantiates that class as a new object. Pointing it at AppDelegate
 * creates a second, empty AppDelegate that never ran didFinishLaunching, so
 * React Native never attaches to the real window.
 *
 * This plugin (managed workflow; also applied to a local ios/ tree EAS uploads):
 * 1. Writes UIApplicationSceneManifest → SceneDelegate
 * 2. Adds SceneDelegate.h/.m and compiles them
 * 3. Stops RCTAppDelegate from auto-creating a non-scene window
 * 4. Creates UIWindow via initWithWindowScene: on the shared AppDelegate
 *
 * Do not install expo-splash-screen JS APIs as part of this fix.
 */
const fs = require('node:fs');
const path = require('node:path');
const { withAppDelegate, withDangerousMod, withInfoPlist } = require('@expo/config-plugins');

const MARKER = 'RAPID_CORTEX_UISCENE_V4';
const LEGACY_MARKER = 'RAPID_CORTEX_UISCENE_BEGIN';
const SCENE_DELEGATE_CLASS = 'SceneDelegate';

const PBX_IDS = {
  mFile: 'F7A91C2B0E4D4A1B8C3D5E01',
  mBuild: 'F7A91C2B0E4D4A1B8C3D5E02',
  hFile: 'F7A91C2B0E4D4A1B8C3D5E03',
};

function buildSceneManifest(delegateClassName) {
  return {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: delegateClassName,
        },
      ],
    },
  };
}

const SCENE_DELEGATE_H = `#import <UIKit/UIKit.h>

@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end
`;

const SCENE_DELEGATE_M = `#import "SceneDelegate.h"
#import "AppDelegate.h"
#import <React/RCTLinkingManager.h>

@implementation SceneDelegate

- (void)scene:(UIScene *)scene
willConnectToSession:(UISceneSession *)session
      options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }
  AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
  [appDelegate rc_startReactNativeInWindowScene:(UIWindowScene *)scene];
  self.window = appDelegate.window;

  if (connectionOptions.URLContexts.count > 0) {
    [self scene:scene openURLContexts:connectionOptions.URLContexts];
  }
  NSUserActivity *activity = connectionOptions.userActivities.anyObject;
  if (activity != nil) {
    [self scene:scene continueUserActivity:activity];
  }
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *context in URLContexts) {
    [RCTLinkingManager application:[UIApplication sharedApplication]
                           openURL:context.URL
                           options:@{}];
  }
}

- (void)scene:(UIScene *)scene continueUserActivity:(NSUserActivity *)userActivity
{
  [RCTLinkingManager application:[UIApplication sharedApplication]
            continueUserActivity:userActivity
              restorationHandler:^(NSArray<id<UIUserActivityRestoring>> *_Nullable restorableObjects) {
              }];
}

@end
`;

const LAUNCH_INJECT = `  // ${MARKER}
  RCInstallFatalGuards();
  self.automaticallyLoadReactNativeWindow = NO;
  RCLaunchOptions = [launchOptions copy];
`;

const SUPER_RETURN_REPLACEMENT = `  BOOL rcLaunchOk = [super application:application didFinishLaunchingWithOptions:launchOptions];
  if (RCPendingWindowScene != nil) {
    [self rc_startReactNativeInWindowScene:RCPendingWindowScene];
  }
  return rcLaunchOk;`;

const FATAL_GUARDS = `static void RCUncaughtExceptionHandler(NSException *exception)
{
  NSLog(@"[RapidCortex] uncaught %@: %@", exception.name, exception.reason);
}

static void RCInstallFatalGuards(void)
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSSetUncaughtExceptionHandler(&RCUncaughtExceptionHandler);
    // Release RCTFatal throws an NSException that is not caught (DEBUG wraps it
    // in @try). TestFlight 32 SIGABRT'd on ExceptionsManagerQueue because of that.
    RCTSetFatalHandler(^(NSError *error) {
      NSLog(@"[RapidCortex] RCTFatal: %@", error.localizedDescription);
      NSLog(@"[RapidCortex] RCTFatal info: %@", error.userInfo);
    });
    RCTSetFatalExceptionHandler(^(NSException *exception) {
      NSLog(@"[RapidCortex] RCTFatalException %@: %@", exception.name, exception.reason);
    });
  });
}

`;

const START_METHOD = `
// ${MARKER}: placeholder window immediately; attach RN on the next runloop tick
// so AppRegistry.registerComponent('main') can finish before runApplication.
- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene
{
  if (windowScene == nil) {
    return;
  }

  UIColor *bootColor = [UIColor colorWithRed:0 green:(CGFloat)4 / 255.0 blue:(CGFloat)14 / 255.0 alpha:1];
  UIWindow *window = self.window;
  if (window == nil || window.windowScene != windowScene) {
    window = [[UIWindow alloc] initWithWindowScene:windowScene];
    window.backgroundColor = bootColor;
    UIViewController *placeholder = [UIViewController new];
    placeholder.view.backgroundColor = bootColor;
    window.rootViewController = placeholder;
    self.window = window;
  }

  id<UIWindowSceneDelegate> sceneDelegate = (id<UIWindowSceneDelegate>)windowScene.delegate;
  if ([sceneDelegate respondsToSelector:@selector(setWindow:)]) {
    sceneDelegate.window = window;
  }
  [window makeKeyAndVisible];

  RCPendingWindowScene = windowScene;
  if (self.rootViewFactory == nil || self.moduleName.length == 0) {
    return;
  }
  dispatch_async(dispatch_get_main_queue(), ^{
    [self rc_attachReactNativeRoot];
  });
}

- (void)rc_attachReactNativeRoot
{
  if (RCReactNativeAttached) {
    return;
  }
  UIWindowScene *windowScene = RCPendingWindowScene;
  if (windowScene == nil || self.rootViewFactory == nil || self.moduleName.length == 0) {
    return;
  }

  UIColor *bootColor = [UIColor colorWithRed:0 green:(CGFloat)4 / 255.0 blue:(CGFloat)14 / 255.0 alpha:1];
  UIWindow *window = self.window;
  if (window == nil || window.windowScene != windowScene) {
    window = [[UIWindow alloc] initWithWindowScene:windowScene];
    window.backgroundColor = bootColor;
    self.window = window;
  }

  NSDictionary *launchOptions = RCLaunchOptions ?: @{};
  UIView *rootView = [self.rootViewFactory viewWithModuleName:self.moduleName
                                            initialProperties:self.initialProps
                                                launchOptions:launchOptions];
  rootView.backgroundColor = bootColor;
  UIViewController *rootViewController = [self createRootViewController];
  [self setRootView:rootView toRootViewController:rootViewController];
  window.rootViewController = rootViewController;
  self.window = window;
  id<UIWindowSceneDelegate> sceneDelegate = (id<UIWindowSceneDelegate>)windowScene.delegate;
  if ([sceneDelegate respondsToSelector:@selector(setWindow:)]) {
    sceneDelegate.window = window;
  }
  [window makeKeyAndVisible];
  RCPendingWindowScene = nil;
  RCReactNativeAttached = YES;
}

`;

const STATICS = `static NSDictionary *RCLaunchOptions;
static UIWindowScene *RCPendingWindowScene;
static BOOL RCReactNativeAttached;

`;

function ensureLinkingImport(contents) {
  if (contents.includes('RCTLinkingManager')) {
    return contents;
  }
  if (!contents.includes('#import "AppDelegate.h"')) {
    throw new Error(
      '[uiscene] AppDelegate.mm is missing #import "AppDelegate.h" — cannot add RCTLinkingManager',
    );
  }
  return contents.replace(
    '#import "AppDelegate.h"',
    '#import "AppDelegate.h"\n#import <React/RCTLinkingManager.h>',
  );
}

function ensureAssertImport(contents) {
  if (contents.includes('<React/RCTAssert.h>')) {
    return contents;
  }
  if (!contents.includes('#import "AppDelegate.h"')) {
    throw new Error(
      '[uiscene] AppDelegate.mm is missing #import "AppDelegate.h" — cannot add RCTAssert.h',
    );
  }
  return contents.replace(
    '#import "AppDelegate.h"',
    '#import "AppDelegate.h"\n#import <React/RCTAssert.h>',
  );
}

function stripLegacyUiScenePatch(contents) {
  if (contents.includes(MARKER) || !/RAPID_CORTEX_UISCENE/.test(contents)) {
    return contents;
  }

  let next = contents;
  next = next.replace(
    /\nstatic NSDictionary \*RCLaunchOptions;\nstatic UIWindowScene \*RCPendingWindowScene;\n(?:static BOOL RCReactNativeAttached;\n)?\n*/g,
    '\n',
  );
  next = next.replace(
    /\n  \/\/ RAPID_CORTEX_UISCENE[^\n]*\n  self\.automaticallyLoadReactNativeWindow = NO;\n  RCLaunchOptions = \[launchOptions copy\];\n/g,
    '\n',
  );
  next = next.replace(
    /\n[ \t]*BOOL rcLaunchOk = \[super application:application didFinishLaunchingWithOptions:launchOptions\];\n  if \(RCPendingWindowScene != nil\) \{\n    \[self rc_startReactNativeInWindowScene:RCPendingWindowScene\];\n  \}\n  return rcLaunchOk;/g,
    '\n  return [super application:application didFinishLaunchingWithOptions:launchOptions];',
  );
  next = next.replace(/\n\/\/ RAPID_CORTEX_UISCENE[\s\S]*?(?=\n@end)/, '\n');
  return next;
}

function patchObjcAppDelegate(contents) {
  const stripped = stripLegacyUiScenePatch(contents);
  if (stripped.includes(MARKER)) {
    return stripped;
  }

  if (!/@implementation\s+AppDelegate\b/.test(stripped)) {
    throw new Error('[uiscene] AppDelegate.mm has no @implementation AppDelegate');
  }

  const withStatics = stripped.replace(
    /@implementation\s+AppDelegate\b/,
    `${FATAL_GUARDS}@implementation AppDelegate\n\n${STATICS}`,
  );

  const launchSig =
    /- \(BOOL\)application:\(UIApplication \*\)application didFinishLaunchingWithOptions:\(NSDictionary \*\)launchOptions\s*\{/;
  if (!launchSig.test(withStatics)) {
    throw new Error(
      '[uiscene] AppDelegate.mm didFinishLaunchingWithOptions not found — cannot disable auto window',
    );
  }
  const withLaunch = withStatics.replace(launchSig, (match) => `${match}\n${LAUNCH_INJECT}`);

  const superReturn =
    /^[ \t]*return \[super application:application didFinishLaunchingWithOptions:launchOptions\];/m;
  if (!superReturn.test(withLaunch)) {
    throw new Error(
      '[uiscene] AppDelegate.mm super didFinishLaunching return not found — cannot flush pending scene',
    );
  }
  const withSuper = withLaunch.replace(superReturn, SUPER_RETURN_REPLACEMENT);
  const withImport = ensureAssertImport(ensureLinkingImport(withSuper));

  const lastEnd = withImport.lastIndexOf('@end');
  if (lastEnd === -1) {
    throw new Error('[uiscene] AppDelegate.mm missing @end');
  }
  return `${withImport.slice(0, lastEnd)}${START_METHOD}${withImport.slice(lastEnd)}`;
}

function patchObjcAppDelegateHeader(contents) {
  if (contents.includes('rc_startReactNativeInWindowScene')) {
    return contents;
  }
  if (!/@interface\s+AppDelegate\b/.test(contents)) {
    throw new Error('[uiscene] AppDelegate.h has no @interface AppDelegate');
  }
  return contents.replace(
    /@interface\s+AppDelegate\s*:\s*\w+[^\n]*\n/,
    (match) => `${match}\n- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene;\n`,
  );
}

function patchPbxproj(contents, projectName) {
  if (contents.includes('SceneDelegate.m')) {
    return contents;
  }
  if (!contents.includes('AppDelegate.mm')) {
    throw new Error('[uiscene] project.pbxproj has no AppDelegate.mm — cannot add SceneDelegate');
  }

  const name = projectName || 'RapidCortex';
  let next = contents;

  next = next.replace(
    /(13B07FBC1A68108700A75B9A \/\* AppDelegate\.mm in Sources \*\/ = \{isa = PBXBuildFile; fileRef = 13B07FB01A68108700A75B9A \/\* AppDelegate\.mm \*\/; \};\n)/,
    `$1\t\t${PBX_IDS.mBuild} /* SceneDelegate.m in Sources */ = {isa = PBXBuildFile; fileRef = ${PBX_IDS.mFile} /* SceneDelegate.m */; };\n`,
  );
  if (!next.includes(`${PBX_IDS.mBuild} /* SceneDelegate.m in Sources */`)) {
    next = next.replace(
      /\/\* End PBXBuildFile section \*\//,
      `\t\t${PBX_IDS.mBuild} /* SceneDelegate.m in Sources */ = {isa = PBXBuildFile; fileRef = ${PBX_IDS.mFile} /* SceneDelegate.m */; };\n/* End PBXBuildFile section */`,
    );
  }

  const fileRefs = `\t\t${PBX_IDS.mFile} /* SceneDelegate.m */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; name = SceneDelegate.m; path = ${name}/SceneDelegate.m; sourceTree = "<group>"; };\n\t\t${PBX_IDS.hFile} /* SceneDelegate.h */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.c.h; name = SceneDelegate.h; path = ${name}/SceneDelegate.h; sourceTree = "<group>"; };\n`;
  if (!next.includes(`path = ${name}/SceneDelegate.m`)) {
    next = next.replace(
      /\/\* End PBXFileReference section \*\//,
      `${fileRefs}/* End PBXFileReference section */`,
    );
  }
  if (!next.includes(`path = ${name}/SceneDelegate.m`)) {
    throw new Error('[uiscene] failed to add SceneDelegate.m PBXFileReference');
  }

  next = next.replace(
    /(13B07FB01A68108700A75B9A \/\* AppDelegate\.mm \*\/,\n)/,
    `$1\t\t\t\t${PBX_IDS.hFile} /* SceneDelegate.h */,\n\t\t\t\t${PBX_IDS.mFile} /* SceneDelegate.m */,\n`,
  );

  next = next.replace(
    /(13B07FBC1A68108700A75B9A \/\* AppDelegate\.mm in Sources \*\/,\n)/,
    `$1\t\t\t\t${PBX_IDS.mBuild} /* SceneDelegate.m in Sources */,\n`,
  );
  if (!next.includes(`${PBX_IDS.mBuild} /* SceneDelegate.m in Sources */,`)) {
    throw new Error('[uiscene] failed to add SceneDelegate.m to Compile Sources');
  }

  return next;
}

function patchInfoPlistXml(contents) {
  if (contents.includes('<key>UIApplicationSceneManifest</key>')) {
    if (!contents.includes('<key>UISceneDelegateClassName</key>')) {
      throw new Error(
        '[uiscene] Info.plist has UIApplicationSceneManifest but no UISceneDelegateClassName',
      );
    }
    return contents.replace(
      /(<key>UISceneDelegateClassName<\/key>\s*<string>)[^<]+(<\/string>)/,
      `$1${SCENE_DELEGATE_CLASS}$2`,
    );
  }

  const manifestXml = `    <key>UIApplicationSceneManifest</key>
    <dict>
      <key>UIApplicationSupportsMultipleScenes</key>
      <false/>
      <key>UISceneConfigurations</key>
      <dict>
        <key>UIWindowSceneSessionRoleApplication</key>
        <array>
          <dict>
            <key>UISceneConfigurationName</key>
            <string>Default Configuration</string>
            <key>UISceneDelegateClassName</key>
            <string>${SCENE_DELEGATE_CLASS}</string>
          </dict>
        </array>
      </dict>
    </dict>
`;

  if (contents.includes('<key>UILaunchStoryboardName</key>')) {
    return contents.replace('<key>UILaunchStoryboardName</key>', `${manifestXml}    <key>UILaunchStoryboardName</key>`);
  }
  if (contents.includes('<key>UIBackgroundModes</key>')) {
    return contents.replace('<key>UIBackgroundModes</key>', `${manifestXml}    <key>UIBackgroundModes</key>`);
  }
  throw new Error('[uiscene] Info.plist has no insertion point for UIApplicationSceneManifest');
}

function findXcodeprojName(iosRoot) {
  const entries = fs.readdirSync(iosRoot);
  const proj = entries.find((entry) => entry.endsWith('.xcodeproj'));
  if (!proj) {
    throw new Error(`[uiscene] no .xcodeproj in ${iosRoot}`);
  }
  return proj.replace(/\.xcodeproj$/, '');
}

function applyUiSceneToIosProject(iosRoot, projectName) {
  const name = projectName || findXcodeprojName(iosRoot);
  const appDir = path.join(iosRoot, name);
  if (!fs.existsSync(appDir)) {
    throw new Error(`[uiscene] missing app dir ${appDir}`);
  }

  fs.writeFileSync(path.join(appDir, 'SceneDelegate.h'), SCENE_DELEGATE_H);
  fs.writeFileSync(path.join(appDir, 'SceneDelegate.m'), SCENE_DELEGATE_M);

  const headerPath = path.join(appDir, 'AppDelegate.h');
  fs.writeFileSync(headerPath, patchObjcAppDelegateHeader(fs.readFileSync(headerPath, 'utf8')));

  const implPath = path.join(appDir, 'AppDelegate.mm');
  fs.writeFileSync(implPath, patchObjcAppDelegate(fs.readFileSync(implPath, 'utf8')));

  const infoPath = path.join(appDir, 'Info.plist');
  fs.writeFileSync(infoPath, patchInfoPlistXml(fs.readFileSync(infoPath, 'utf8')));

  const pbxPath = path.join(iosRoot, `${name}.xcodeproj`, 'project.pbxproj');
  fs.writeFileSync(pbxPath, patchPbxproj(fs.readFileSync(pbxPath, 'utf8'), name));
}

function withUiSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = buildSceneManifest(SCENE_DELEGATE_CLASS);
    return cfg;
  });

  config = withAppDelegate(config, (cfg) => {
    const language = cfg.modResults.language;
    if (language === 'swift') {
      throw new Error(
        '[uiscene] Swift AppDelegate is not supported on Expo SDK 52. This plugin patches AppDelegate.mm.',
      );
    }
    cfg.modResults.contents = patchObjcAppDelegate(cfg.modResults.contents);
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      applyUiSceneToIosProject(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName);
      return cfg;
    },
  ]);

  return config;
}

module.exports = withUiSceneLifecycle;
module.exports.patchObjcAppDelegate = patchObjcAppDelegate;
module.exports.patchObjcAppDelegateHeader = patchObjcAppDelegateHeader;
module.exports.patchPbxproj = patchPbxproj;
module.exports.patchInfoPlistXml = patchInfoPlistXml;
module.exports.stripLegacyUiScenePatch = stripLegacyUiScenePatch;
module.exports.buildSceneManifest = buildSceneManifest;
module.exports.applyUiSceneToIosProject = applyUiSceneToIosProject;
module.exports.MARKER = MARKER;
module.exports.SCENE_DELEGATE_CLASS = SCENE_DELEGATE_CLASS;
module.exports.SCENE_DELEGATE_H = SCENE_DELEGATE_H;
module.exports.SCENE_DELEGATE_M = SCENE_DELEGATE_M;
