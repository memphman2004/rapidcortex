import { describe, expect, it } from "vitest";
import {
  isSdk52ReactNative,
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

describe("pin ExpoModulesCore to the mobile React Native", () => {
  it("treats 0.80 as New Architecture ExpoModulesCore (the EAS failure)", () => {
    expect(reactNativeMinor("0.80.3")).toBe(80);
    expect(reactNativeMinor("0.76.9")).toBe(76);
    expect(isSdk52ReactNative("0.80.3")).toBe(false);
    expect(isSdk52ReactNative("0.76.9")).toBe(true);
  });

  it("rewrites Node require probes to the app's package.json path", () => {
    const rnJson = "/Users/expo/workingdir/build/apps/mobile/node_modules/react-native/package.json";
    const patched = patchExpoModulesCorePodspec(SAMPLE, rnJson);

    expect(patched).toContain(`File.read('${rnJson}')`);
    expect(patched).toContain(`File.dirname('${rnJson}')`);
    expect(patched).not.toContain("require.resolve('react-native/package.json')");
    expect(patched).not.toContain("require('react-native/package.json').version");

    const again = patchExpoModulesCorePodspec(patched, rnJson);
    expect(again).toBe(patched);
  });
});
