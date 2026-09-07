import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extraNodeModulesForWorkspace,
  materializeNestedPolyfills,
  resolvePackageDir,
  resolveSharedPackageModule,
  sharedPackageNodeModuleDir,
  resolveSdk52ScreensDir,
  resolveSdk52ReactNativeDir,
  duplicateReactNativeDirs,
  resolveReactNativeModule,
} from "./metro-resolve-nested.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mobileRoot = path.join(repoRoot, "apps/android-mobile");

describe("metro nested polyfill resolution", () => {
  it("finds isarray under buffer when root isarray is a dev-only hoist", () => {
    const fromBuffer = path.join(repoRoot, "node_modules", "buffer");
    const dir = resolvePackageDir("isarray", [fromBuffer]);
    expect(dir).toBeTruthy();
    expect(dir).toContain(`${path.sep}isarray`);
  });

  it("maps isarray into extraNodeModules for the mobile workspace", () => {
    const extra = extraNodeModulesForWorkspace(mobileRoot, repoRoot);
    expect(extra.isarray).toBeTruthy();
    expect(extra["base64-js"]).toBeTruthy();
    expect(extra.ieee754).toBeTruthy();
  });

  it("copies missing isarray into apps/android-mobile/node_modules from buffer", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metro-nested-"));
    const projectRoot = path.join(tmp, "mobile");
    const workspaceRoot = path.join(tmp, "workspace");
    const nested = path.join(
      workspaceRoot,
      "node_modules",
      "buffer",
      "node_modules",
      "isarray",
    );
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(
      path.join(nested, "package.json"),
      JSON.stringify({ name: "isarray", version: "1.0.0" }),
    );

    const copied = materializeNestedPolyfills(projectRoot, workspaceRoot);
    const mobileCopy = path.join(projectRoot, "node_modules", "isarray", "package.json");
    const rootCopy = path.join(workspaceRoot, "node_modules", "isarray", "package.json");

    expect(copied.length).toBeGreaterThan(0);
    expect(fs.existsSync(mobileCopy)).toBe(true);
    expect(JSON.parse(fs.readFileSync(mobileCopy, "utf8")).version).toBe("1.0.0");
    expect(fs.existsSync(rootCopy)).toBe(true);

    const extra = extraNodeModulesForWorkspace(projectRoot, workspaceRoot);
    expect(fs.realpathSync(extra.isarray)).toBe(
      fs.realpathSync(path.join(projectRoot, "node_modules", "isarray")),
    );
  });

  it("points rapid-cortex-shared at dist so Metro does not load src/*.ts .js specifiers", () => {
    const sharedRoot = path.join(repoRoot, "packages", "shared");
    const distIndex = path.join(sharedRoot, "dist", "index.js");
    expect(fs.existsSync(distIndex)).toBe(true);
    expect(sharedPackageNodeModuleDir(sharedRoot)).toBe(path.join(sharedRoot, "dist"));
    const resolved = resolveSharedPackageModule("rapid-cortex-shared", sharedRoot);
    expect(resolved?.filePath).toBe(distIndex);
    expect(resolveSharedPackageModule("@/lib/foo", sharedRoot)).toBeNull();
  });

  it("prefers react-native-screens 4.4.x over a hoisted 4.26 peer", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metro-screens-"));
    const projectRoot = path.join(tmp, "mobile");
    const workspaceRoot = path.join(tmp, "workspace");
    const mobileScreens = path.join(projectRoot, "node_modules", "react-native-screens");
    const rootScreens = path.join(workspaceRoot, "node_modules", "react-native-screens");
    fs.mkdirSync(mobileScreens, { recursive: true });
    fs.mkdirSync(rootScreens, { recursive: true });
    fs.writeFileSync(
      path.join(mobileScreens, "package.json"),
      JSON.stringify({ name: "react-native-screens", version: "4.4.0" }),
    );
    fs.writeFileSync(
      path.join(rootScreens, "package.json"),
      JSON.stringify({ name: "react-native-screens", version: "4.26.1" }),
    );
    expect(resolveSdk52ScreensDir(projectRoot, workspaceRoot)).toBe(mobileScreens);
  });

  it("blocks a second physical react-native tree so BatchedBridge is not evaluated twice", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metro-rn-dup-"));
    const projectRoot = path.join(tmp, "mobile");
    const workspaceRoot = path.join(tmp, "workspace");
    const mobileRn = path.join(projectRoot, "node_modules", "react-native");
    const rootRn = path.join(workspaceRoot, "node_modules", "react-native");
    fs.mkdirSync(mobileRn, { recursive: true });
    fs.mkdirSync(rootRn, { recursive: true });
    fs.writeFileSync(
      path.join(mobileRn, "package.json"),
      JSON.stringify({ name: "react-native", version: "0.76.9" }),
    );
    fs.writeFileSync(
      path.join(rootRn, "package.json"),
      JSON.stringify({ name: "react-native", version: "0.76.9" }),
    );
    expect(resolveSdk52ReactNativeDir(projectRoot, workspaceRoot)).toBe(mobileRn);
    expect(duplicateReactNativeDirs(mobileRn, projectRoot, workspaceRoot)).toEqual([
      rootRn,
    ]);
  });

  it("resolves react-native subpaths from the SDK 52 tree", () => {
    const rnDir = path.join(mobileRoot, "node_modules", "react-native");
    const root = resolveReactNativeModule("react-native", rnDir);
    const bridge = resolveReactNativeModule(
      "react-native/Libraries/BatchedBridge/BatchedBridge",
      rnDir,
    );
    expect(root?.filePath).toBeTruthy();
    expect(bridge?.filePath).toContain(`${path.sep}BatchedBridge`);
    expect(resolveReactNativeModule("react-native-gesture-handler", rnDir)).toBeNull();
  });
});

describe("metro watch crawl exclusions", () => {
  it("does not crawl ios/Pods so Debug index.bundle can start", () => {
    const source = fs.readFileSync(
      path.join(mobileRoot, "metro.config.js"),
      "utf8",
    );
    expect(source).toContain("ios/Pods on this volume never finished");
    expect(source).toContain("Match the directory itself so the Node crawler");
    expect(source).toContain("EAS_BUILD === 'true'");
  });
});
