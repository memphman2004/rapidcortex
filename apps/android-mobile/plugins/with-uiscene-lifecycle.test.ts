import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSceneManifest,
  MARKER,
  patchInfoPlistXml,
  patchObjcAppDelegate,
  patchObjcAppDelegateHeader,
  patchPbxproj,
  SCENE_DELEGATE_CLASS,
} from "./with-uiscene-lifecycle.js";

/** Expo SDK 52 bare-minimum AppDelegate.mm (sdk-52 template). */
const EXPO_52_APP_DELEGATE = `#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"main";

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

@end
`;

const V1_APP_DELEGATE = `#import "AppDelegate.h"
#import <React/RCTLinkingManager.h>

@implementation AppDelegate

static NSDictionary *RCLaunchOptions;
static UIWindowScene *RCPendingWindowScene;

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // RAPID_CORTEX_UISCENE_BEGIN
  self.automaticallyLoadReactNativeWindow = NO;
  RCLaunchOptions = [launchOptions copy];

  self.moduleName = @"main";
  self.initialProps = @{};

    BOOL rcLaunchOk = [super application:application didFinishLaunchingWithOptions:launchOptions];
  if (RCPendingWindowScene != nil) {
    [self rc_startReactNativeInWindowScene:RCPendingWindowScene];
  }
  return rcLaunchOk;
}

// RAPID_CORTEX_UISCENE_BEGIN: RN window must be created with initWithWindowScene: (Xcode 26 / iOS 26).
- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene
{
}

- (void)scene:(UIScene *)scene
willConnectToSession:(UISceneSession *)session
      options:(UISceneConnectionOptions *)connectionOptions
{
}

@end
`;

describe("with-uiscene-lifecycle", () => {
  it("writes a single-scene manifest pointing at SceneDelegate", () => {
    const manifest = buildSceneManifest(SCENE_DELEGATE_CLASS);
    expect(manifest.UIApplicationSupportsMultipleScenes).toBe(false);
    const configs =
      manifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication;
    expect(configs).toHaveLength(1);
    expect(configs[0].UISceneConfigurationName).toBe("Default Configuration");
    expect(configs[0].UISceneDelegateClassName).toBe("SceneDelegate");
  });

  it("patches Expo 52 AppDelegate.mm to create the RN window from the scene", () => {
    const patched = patchObjcAppDelegate(EXPO_52_APP_DELEGATE);
    expect(patched).toContain(MARKER);
    expect(patched).toContain("self.automaticallyLoadReactNativeWindow = NO");
    expect(patched).toContain("initWithWindowScene:");
    expect(patched).toContain("rc_startReactNativeInWindowScene:");
    expect(patched).toContain("rc_attachReactNativeRoot");
    expect(patched).toContain("rc_tryStartDevLauncherWithWindow");
    expect(patched).toContain("#if DEBUG");
    expect(patched).toContain('NSClassFromString(@"EXDevLauncherController")');
    expect(patched).toContain("RCTSetFatalHandler");
    expect(patched).toContain("RCTSetFatalExceptionHandler");
    expect(patched).toContain("dispatch_async(dispatch_get_main_queue()");
    expect(patched).toContain("RCPendingWindowScene");
    expect(patched).toContain("RCReactNativeAttached");
    expect(patched).toContain("sceneDelegate.window = window");
    expect(patched).toContain("#import <React/RCTAssert.h>");
    expect(patched).not.toContain("if (self.window != nil || windowScene == nil)");
    expect(patched).not.toContain("willConnectToSession:");
    expect(patched).not.toContain(
      "return [super application:application didFinishLaunchingWithOptions:launchOptions];",
    );
    expect(patched).toContain(
      "BOOL rcLaunchOk = [super application:application didFinishLaunchingWithOptions:launchOptions];",
    );
  });

  it("upgrades the v1 AppDelegate-as-scene-delegate patch", () => {
    const patched = patchObjcAppDelegate(V1_APP_DELEGATE);
    expect(patched).toContain(MARKER);
    expect(patched).not.toContain("RAPID_CORTEX_UISCENE_BEGIN");
    expect(patched).not.toContain("willConnectToSession:");
    expect(patched.split("automaticallyLoadReactNativeWindow = NO").length).toBe(2);
    expect(patched.split("rc_startReactNativeInWindowScene:").length).toBe(3);
    expect(patched).toContain("rc_attachReactNativeRoot");
    expect(patched).toContain("rc_tryStartDevLauncherWithWindow");
  });

  it("upgrades the v2 empty-window patch", () => {
    const v2 = `#import "AppDelegate.h"
@implementation AppDelegate
static NSDictionary *RCLaunchOptions;
static UIWindowScene *RCPendingWindowScene;
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // RAPID_CORTEX_UISCENE_V2
  self.automaticallyLoadReactNativeWindow = NO;
  RCLaunchOptions = [launchOptions copy];
  self.moduleName = @"main";
  BOOL rcLaunchOk = [super application:application didFinishLaunchingWithOptions:launchOptions];
  if (RCPendingWindowScene != nil) {
    [self rc_startReactNativeInWindowScene:RCPendingWindowScene];
  }
  return rcLaunchOk;
}
// RAPID_CORTEX_UISCENE_V2: RN window must be created with initWithWindowScene: (Xcode 26 / iOS 26).
- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene
{
  if (self.window != nil || windowScene == nil) {
    return;
  }
}
@end
`;
    const patched = patchObjcAppDelegate(v2);
    expect(patched).toContain(MARKER);
    expect(patched).toContain("sceneDelegate.window = window");
    expect(patched).not.toContain("if (self.window != nil || windowScene == nil)");
  });

  it("upgrades the v4 AppDelegate to start Dev Launcher after the scene window", () => {
    const v4 = `#import "AppDelegate.h"
#import <React/RCTAssert.h>

static void RCUncaughtExceptionHandler(NSException *exception)
{
  NSLog(@"[RapidCortex] uncaught %@: %@", exception.name, exception.reason);
}

static void RCInstallFatalGuards(void)
{
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    NSSetUncaughtExceptionHandler(&RCUncaughtExceptionHandler);
    RCTSetFatalHandler(^(NSError *error) {
      NSLog(@"[RapidCortex] RCTFatal: %@", error.localizedDescription);
    });
    RCTSetFatalExceptionHandler(^(NSException *exception) {
      NSLog(@"[RapidCortex] RCTFatalException %@: %@", exception.name, exception.reason);
    });
  });
}

@implementation AppDelegate

static NSDictionary *RCLaunchOptions;
static UIWindowScene *RCPendingWindowScene;
static BOOL RCReactNativeAttached;

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // RAPID_CORTEX_UISCENE_V4
  RCInstallFatalGuards();
  self.automaticallyLoadReactNativeWindow = NO;
  RCLaunchOptions = [launchOptions copy];
  self.moduleName = @"main";
  BOOL rcLaunchOk = [super application:application didFinishLaunchingWithOptions:launchOptions];
  if (RCPendingWindowScene != nil) {
    [self rc_startReactNativeInWindowScene:RCPendingWindowScene];
  }
  return rcLaunchOk;
}

// RAPID_CORTEX_UISCENE_V4: placeholder window immediately
- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene
{
}

@end
`;
    const patched = patchObjcAppDelegate(v4);
    expect(patched).toContain("RAPID_CORTEX_UISCENE_V6");
    expect(patched).not.toContain("RAPID_CORTEX_UISCENE_V4");
    expect(patched).toContain("rc_tryStartDevLauncherWithWindow");
    expect(patched.split("static void RCInstallFatalGuards").length).toBe(2);
    expect(patched.split("automaticallyLoadReactNativeWindow = NO").length).toBe(2);
  });

  it("upgrades v5 so TestFlight Release never starts Dev Launcher", () => {
    const v5 = `#import "AppDelegate.h"
@implementation AppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // RAPID_CORTEX_UISCENE_V5
  self.automaticallyLoadReactNativeWindow = NO;
  RCLaunchOptions = [launchOptions copy];
  self.moduleName = @"main";
  BOOL rcLaunchOk = [super application:application didFinishLaunchingWithOptions:launchOptions];
  if (RCPendingWindowScene != nil) {
    [self rc_startReactNativeInWindowScene:RCPendingWindowScene];
  }
  return rcLaunchOk;
}
// RAPID_CORTEX_UISCENE_V5: placeholder window immediately
- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene
{
}
- (void)rc_attachReactNativeRoot
{
  if ([self rc_tryStartDevLauncherWithWindow:window]) {
    return;
  }
}
@end
`;
    const patched = patchObjcAppDelegate(v5);
    expect(patched).toContain("RAPID_CORTEX_UISCENE_V6");
    expect(patched).not.toContain("RAPID_CORTEX_UISCENE_V5");
    expect(patched).toContain("#if DEBUG");
  });

  it("is idempotent", () => {
    const once = patchObjcAppDelegate(EXPO_52_APP_DELEGATE);
    const twice = patchObjcAppDelegate(once);
    expect(twice).toBe(once);
  });

  it("declares the start method on AppDelegate.h", () => {
    const patched = patchObjcAppDelegateHeader(
      `#import <UIKit/UIKit.h>\n@interface AppDelegate : EXAppDelegateWrapper\n\n@end\n`,
    );
    expect(patched).toContain(
      "- (void)rc_startReactNativeInWindowScene:(UIWindowScene *)windowScene;",
    );
    expect(patchObjcAppDelegateHeader(patched)).toBe(patched);
  });

  it("points Info.plist at SceneDelegate", () => {
    const fromAppDelegate = patchInfoPlistXml(`
    <key>UIApplicationSceneManifest</key>
    <dict>
      <key>UISceneDelegateClassName</key>
      <string>AppDelegate</string>
    </dict>
    <key>UILaunchStoryboardName</key>
`);
    expect(fromAppDelegate).toContain(
      "<key>UISceneDelegateClassName</key>\n      <string>SceneDelegate</string>",
    );

    const inserted = patchInfoPlistXml(`    <key>UILaunchStoryboardName</key>\n`);
    expect(inserted).toContain("<key>UIApplicationSceneManifest</key>");
    expect(inserted).toContain("<string>SceneDelegate</string>");
  });

  it("adds SceneDelegate.m to the Xcode project", () => {
    const fixture = readFileSync(
      path.join(__dirname, "../ios/RapidCortex.xcodeproj/project.pbxproj"),
      "utf8",
    );
    const patched = patchPbxproj(fixture, "RapidCortex");
    expect(patched).toContain("SceneDelegate.m in Sources");
    expect(patched).toContain("RapidCortex/SceneDelegate.m");
    expect(patched).toContain("RapidCortex/SceneDelegate.h");
    expect(patchPbxproj(patched, "RapidCortex")).toBe(patched);
  });

  it("fails loud when didFinishLaunching is missing", () => {
    expect(() =>
      patchObjcAppDelegate(`#import "AppDelegate.h"\n@implementation AppDelegate\n@end\n`),
    ).toThrow(/didFinishLaunchingWithOptions not found/);
  });
});
