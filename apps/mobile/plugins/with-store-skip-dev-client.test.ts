import { describe, expect, it } from "vitest";
import {
  EXCLUDE,
  MARKER,
  patchPackageJsonAutolinking,
  patchPodfileUseExpoModules,
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
    expect(once.contents).toContain("ENV['EAS_BUILD_PROFILE'] == 'production'");
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
});
