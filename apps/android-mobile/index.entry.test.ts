import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "index.js"), "utf8");

describe("mobile entry registers main synchronously", () => {
  it("does not use expo-router/entry (startTransition defers AppRegistry)", () => {
    expect(source).not.toMatch(/^import ['"]expo-router\/entry['"]/m);
    expect(source).not.toMatch(/from ['"]expo['"]/);
    expect(source).toContain("AppRegistry.registerComponent('main'");
    expect(source).toContain("expo-router/build/qualified-entry");
    expect(source).toContain("pinBatchedBridge");
    expect(source).toContain("__fbBatchedBridge");
    expect(source).toContain("react-native/Libraries/BatchedBridge/BatchedBridge");
  });

  it("installs an ErrorUtils guard so release RCTFatal cannot SIGABRT", () => {
    expect(source).toContain("installJsFatalGuard");
    expect(source).toContain("setGlobalHandler");
    expect(source).toContain("BootBoundary");
  });
});
