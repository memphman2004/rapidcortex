import { describe, expect, it } from "vitest";
import { dispatcherSectionPopoutPath, isDispatcherPopoutPath, isDispatcherPopoutSection, visibleDockModules } from "./section-popout";

describe("dispatcher section pop-out", () => {
  it("builds a section window url for the current incident", () => {
    expect(dispatcherSectionPopoutPath("columbus", "transcript", "inc-1")).toBe(
      "/columbus/dispatcher/popout?section=transcript&incident=inc-1",
    );
    expect(dispatcherSectionPopoutPath("columbus", "queue")).toBe(
      "/columbus/dispatcher/popout?section=queue",
    );
  });

  it("recognizes pop-out sections and paths", () => {
    expect(isDispatcherPopoutSection("cad_ready")).toBe(true);
    expect(isDispatcherPopoutSection("not-a-section")).toBe(false);
    expect(isDispatcherPopoutPath("/columbus/dispatcher/popout")).toBe(true);
    expect(isDispatcherPopoutPath("/columbus/dispatcher")).toBe(false);
  });

  it("leaves a product out of the module list when it is off", () => {
    const keys = visibleDockModules({
      callerCard: false,
      liveVideo: false,
      incidentMedia: false,
      silentText: false,
      preArrival: true,
      pinpoint: false,
      cameraAi: false,
    }).map((item) => item.key);
    expect(keys).toContain("transcript");
    expect(keys).toContain("pre_arrival");
    expect(keys).not.toContain("camera_ai");
    expect(keys).not.toContain("caller_mobile");
    expect(keys).not.toContain("location");
  });
});
