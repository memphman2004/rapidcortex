import { describe, expect, it } from "vitest";
import {
  MARKER,
  patchDevLauncherGetWindow,
  patchDevLauncherSubscriber,
  QUOTED_FINISH_LAUNCHING,
  UNQUOTED_FINISH_LAUNCHING,
  UNQUOTED_GET_WINDOW,
} from "./patch-expo-dev-launcher-uiscene.js";

describe("patch-expo-dev-launcher-uiscene", () => {
  it("stops Dev Launcher from fatalError when UIScene has no key window yet", () => {
    const src = `public class ExpoDevLauncherAppDelegateSubscriber: ExpoAppDelegateSubscriber {\n${UNQUOTED_FINISH_LAUNCHING}\n}\n`;
    const once = patchDevLauncherSubscriber(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(MARKER);
    expect(once.contents).toContain(QUOTED_FINISH_LAUNCHING);
    expect(once.contents).not.toContain("Cannot find the keyWindow");
    expect(patchDevLauncherSubscriber(once.contents).changed).toBe(false);
  });

  it("resolves the window from the connected UIWindowScene", () => {
    const once = patchDevLauncherGetWindow(UNQUOTED_GET_WINDOW);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain("connectedScenes");
    expect(once.contents).toContain("UIWindowScene");
    expect(patchDevLauncherGetWindow(once.contents).changed).toBe(false);
  });

  it("still defers didFinishLaunching when Expo changes whitespace around keyWindow", () => {
    const src = `public class ExpoDevLauncherAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    guard let window = UIApplication.shared.windows.filter({ $0.isKeyWindow }).first else {
      fatalError("Cannot find the keyWindow. Make sure to call window.makeKeyAndVisible().")
    }
    EXDevLauncherController.sharedInstance().autoSetupStart(window)
    return false
  }
}
`;
    const once = patchDevLauncherSubscriber(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(MARKER);
    expect(once.contents).not.toContain("Cannot find the keyWindow");
  });
});
