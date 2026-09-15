import { describe, expect, it } from "vitest";
import {
  isPinnedMobileReactNative,
  patchExpoModulesCorePodspec,
  reactNativeMinor,
} from "./pin-expo-modules-core-rn.js";

const SAMPLE = `unless defined?(install_modules_dependencies)
  require File.join(File.dirname(\`node --print "require.resolve('react-native/package.json')"\`), "scripts/react_native_pods")
end

reactNativeVersion = '0.0.0'
begin
  reactNativeVersion = \`node --print "require('react-native/package.json').version"\`
rescue
  reactNativeVersion = '0.0.0'
end

reactNativeTargetVersion = reactNativeVersion.split('.')[1].to_i

if reactNativeTargetVersion >= 77
  s.dependency 'ReactAppDependencyProvider'
end
`;

const SAMPLE_SDK53 = [
  "require 'json'",
  "",
  "absolute_react_native_path = ''",
  "if !ENV['REACT_NATIVE_PATH'].nil?",
  "  absolute_react_native_path = File.expand_path(ENV['REACT_NATIVE_PATH'], Pod::Config.instance.project_root)",
  "else",
  '  absolute_react_native_path = File.dirname(`node --print "require.resolve(\'react-native/package.json\')"`)',
  "end",
  "",
  "unless defined?(install_modules_dependencies)",
  '  require File.join(absolute_react_native_path, "scripts/react_native_pods")',
  "end",
  "",
  "reactNativeVersion = '0.0.0'",
  "begin",
  "  reactNativeVersion = `node --print \"require('#{absolute_react_native_path}/package.json').version\"`",
  "rescue",
  "  reactNativeVersion = '0.0.0'",
  "end",
  "",
].join("\n");

describe("pin ExpoModulesCore to the mobile React Native", () => {
  it("treats 0.80 as a hoisted peer, not the pinned mobile React Native", () => {
    expect(reactNativeMinor("0.80.3")).toBe(80);
    expect(reactNativeMinor("0.79.6")).toBe(79);
    expect(isPinnedMobileReactNative("0.80.3")).toBe(false);
    expect(isPinnedMobileReactNative("0.79.6")).toBe(true);
  });

  it("rewrites Node require probes to the app's package.json path", () => {
    const rnJson = "/Users/expo/workingdir/build/apps/android-mobile/node_modules/react-native/package.json";
    const patched = patchExpoModulesCorePodspec(SAMPLE, rnJson);

    expect(patched).toContain(`File.read('${rnJson}')`);
    expect(patched).toContain(`File.dirname('${rnJson}')`);
    expect(patched).not.toContain("require.resolve('react-native/package.json')");
    expect(patched).not.toContain("require('react-native/package.json').version");

    const again = patchExpoModulesCorePodspec(patched, rnJson);
    expect(again).toBe(patched);
  });

  it("pins the SDK 53 ExpoModulesCore.podspec absolute_react_native_path probe", () => {
    const rnJson = "/Users/expo/workingdir/build/apps/android-mobile/node_modules/react-native/package.json";
    const patched = patchExpoModulesCorePodspec(SAMPLE_SDK53, rnJson);

    expect(patched).toContain(`absolute_react_native_path = File.dirname('${rnJson}')`);
    expect(patched).toContain(`File.read('${rnJson}')`);
    expect(patched).not.toContain("require.resolve('react-native/package.json')");
    expect(patched).not.toContain("#{absolute_react_native_path}/package.json");

    const again = patchExpoModulesCorePodspec(patched, rnJson);
    expect(again).toBe(patched);
  });
});
