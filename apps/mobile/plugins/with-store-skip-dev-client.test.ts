import { describe, expect, it } from "vitest";
import {
  EXCLUDE,
  MARKER,
  patchPackageJsonAutolinking,
  patchPodfileUseExpoModules,
  patchSettingsGradleUseExpoModules,
} from "./with-store-skip-dev-client.js";

const EXPO_52_PODFILE = `target 'RapidCortex' do
  use_expo_modules!

  config = use_native_modules!(config_command)
end
`;

describe("with-store-skip-dev-client", () => {
  it("wraps use_expo_modules! so production EAS excludes Dev Launcher", () => {
    const once = patchPodfileUseExpoModules(EXPO_52_PODFILE);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(MARKER);
    expect(once.contents).toContain("ENV['EAS_BUILD_PROFILE'] != 'development'");
    for (const name of EXCLUDE) {
      expect(once.contents).toContain(`'${name}'`);
    }
    expect(once.contents).toContain("use_expo_modules!(exclude:");
    expect(patchPodfileUseExpoModules(once.contents).changed).toBe(false);
  });

  it("leaves a Podfile without use_expo_modules! unchanged", () => {
    const src = "target 'RapidCortex' do\nend\n";
    const once = patchPodfileUseExpoModules(src);
    expect(once.changed).toBe(false);
    expect(once.contents).toBe(src);
  });

  it("adds expo.autolinking.exclude on the mobile package.json", () => {
    const next = patchPackageJsonAutolinking({
      name: "rapid-cortex-mobile",
      expo: { autolinking: { exclude: ["unrelated"] } },
    });
    expect(next.expo.autolinking.exclude).toEqual(["unrelated", ...EXCLUDE]);
  });

  it("wraps useExpoModules() so Android preview/production exclude Dev Launcher", () => {
    const src = `apply from: new File(expoDir, "../scripts/autolinking.gradle");
useExpoModules()

include ':app'
`;
    const once = patchSettingsGradleUseExpoModules(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(MARKER);
    expect(once.contents).toContain('System.getenv("EAS_BUILD_PROFILE") != "development"');
    expect(once.contents).toContain("useExpoModules([exclude:");
    for (const name of EXCLUDE) {
      expect(once.contents).toContain(`"${name}"`);
    }
    expect(patchSettingsGradleUseExpoModules(once.contents).changed).toBe(false);
  });

  it("leaves settings.gradle without useExpoModules() unchanged", () => {
    const src = "include ':app'\n";
    const once = patchSettingsGradleUseExpoModules(src);
    expect(once.changed).toBe(false);
    expect(once.contents).toBe(src);
  });
});
