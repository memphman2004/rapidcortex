import { describe, expect, it } from "vitest";
import { batchEstimateUsd, expandCategoryScenes, firearmMix, generationRetryDelayMs, planStillBatch } from "./studio-batch";

const open = { existingIds: [] as string[], spentUsd: 0, capUsd: 5, confirmed: true };

describe("studio still-image batches", () => {
  it("plans the next firearm batch when the pilot ids are already stored", () => {
    const plan = planStillBatch({ ...open, category: "firearm_like", existingIds: ["firearm-pilot-10-01"] });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.batchId).toBe("firearm-like-b02");
      expect(plan.scenes).toHaveLength(10);
      expect(plan.scenes.filter((scene) => scene.role === "positive" && scene.difficulty === "standard")).toHaveLength(4);
      expect(plan.scenes.filter((scene) => scene.role === "negative" && scene.difficulty === "standard")).toHaveLength(4);
      expect(plan.scenes.filter((scene) => scene.difficulty === "challenging")).toHaveLength(2);
      expect(plan.generated).toBe(false);
    }
  });

  it("moves to the following firearm set after b02 is stored", () => {
    const existingIds = Array.from({ length: 10 }, (_, index) => `firearm-like-b02-${String(index + 1).padStart(2, "0")}`);
    const plan = planStillBatch({ ...open, category: "firearm_like", existingIds });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.batchId).toBe("firearm-like-b03");
  });

  it("asks for confirmation before spending", () => {
    const plan = planStillBatch({ ...open, category: "blade_like", confirmed: false });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.requiresConfirmation).toBe(true);
      expect(plan.estimatedUsd).toBe(0.4);
      expect(plan.reason).toMatch(/knife or blade-like object/i);
    }
  });

  it("allows a visible synthetic face on person scenes and keeps object scenes empty", () => {
    const people = planStillBatch({ ...open, category: "altercation", capUsd: 25 });
    const objects = planStillBatch({ ...open, category: "firearm_like" });
    expect(people.ok && objects.ok).toBe(true);
    if (people.ok) {
      expect(people.scenes[0]?.prompt).toContain("the face may be visible");
      expect(people.scenes[0]?.prompt).toContain("not a real individual");
    }
    if (objects.ok) expect(objects.scenes[0]?.prompt).toContain("No people, no faces");
  });

  it("plans a still frame for every category in the menu", () => {
    for (const choice of ["altercation", "person_down", "forced_entry", "vehicle_collision", "restricted_zone", "blocked_exit", "transit_hazard", "smoke_or_flame"]) {
      const plan = planStillBatch({ ...open, category: choice, capUsd: 25 });
      expect(plan.ok).toBe(true);
      if (plan.ok) expect(plan.scenes).toHaveLength(10);
    }
  });

  it("stops when the spend cap would be passed", () => {
    const plan = planStillBatch({ ...open, category: "firearm_like", spentUsd: 4.8, capUsd: 5 });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toMatch(/spend cap/);
  });

  it("plans 100 distinct firearm scenes after the empty sets are stored", () => {
    const existingIds = ["b02", "b03"].flatMap((batch) =>
      Array.from({ length: 10 }, (_, index) => `firearm-like-${batch}-${String(index + 1).padStart(2, "0")}`),
    );
    const plan = planStillBatch({ ...open, category: "firearm_like", existingIds, capUsd: 50 });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.batchId).toBe("firearm-like-b04");
    expect(plan.requested).toBe(100);
    expect(plan.scenes).toHaveLength(100);
    expect(plan.estimatedUsd).toBe(4);
    expect(plan.scenes.filter((scene) => scene.prompt.includes("A handgun is visible."))).toHaveLength(50);
    expect(plan.scenes.filter((scene) => scene.prompt.includes("holding a phone"))).toHaveLength(10);
    expect(plan.scenes.filter((scene) => scene.prompt.includes("holding a flashlight"))).toHaveLength(10);
    expect(plan.scenes.filter((scene) => scene.prompt.includes("holding a closed umbrella"))).toHaveLength(10);
    expect(plan.scenes.filter((scene) => scene.prompt.includes("holding a power drill"))).toHaveLength(10);
    expect(plan.scenes.filter((scene) => scene.prompt.includes("holding a bottle"))).toHaveLength(10);
    expect(new Set(plan.scenes.map((scene) => scene.id)).size).toBe(100);
    expect(new Set(plan.scenes.map((scene) => scene.prompt)).size).toBe(100);
    expect(new Set(plan.scenes.map((scene) => scene.lighting)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(plan.scenes.map((scene) => scene.cameraAngle)).size).toBeGreaterThanOrEqual(3);
    expect(plan.scenes.some((scene) => scene.role === "negative" && scene.difficulty === "challenging")).toBe(true);
    expect(plan.scenes[0]?.prompt).toContain("CCTV");
    expect(plan.scenes[0]?.prompt).toContain("not a real individual");
    expect(plan.scenes[0]?.prompt).toContain("No text, no logo, and no timestamp");
    expect(plan.scenes.every((scene) => scene.prompt.includes("training") === false)).toBe(true);
  });

  it("resumes a sized batch without changing prompts for images already stored", () => {
    const first = planStillBatch({ ...open, category: "firearm_like", batchSize: 100, capUsd: 50 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const done = first.scenes.slice(0, 40).map((scene) => scene.id);
    const again = planStillBatch({ ...open, category: "firearm_like", batchSize: 100, existingIds: done, capUsd: 50 });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.scenes).toHaveLength(60);
    expect(again.scenes[0]?.id).toBe(first.scenes[40]?.id);
    expect(again.scenes[0]?.prompt).toBe(first.scenes[40]?.prompt);
    expect(again.estimatedUsd).toBe(2.4);
  });

  it("builds the larger firearm mixes and blocks a batch over the spend cap", () => {
    expect(firearmMix(250)).toEqual({ handguns: 125, phones: 25, flashlights: 25, umbrellas: 25, drills: 25, bottles: 25 });
    expect(firearmMix(1000)).toEqual({ handguns: 500, phones: 100, flashlights: 100, umbrellas: 100, drills: 100, bottles: 100 });
    expect(expandCategoryScenes("firearm_like", 250)).toHaveLength(250);
    expect(batchEstimateUsd(1000)).toBe(40);
    const blocked = planStillBatch({ ...open, category: "firearm_like", batchSize: 1000, spentUsd: 0.04, capUsd: 40 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toMatch(/spend cap/);
    const refused = planStillBatch({ ...open, category: "firearm_like", batchSize: 10, capUsd: 50 });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toMatch(/100, 250, 500, or 1,000/);
  });

  it("waits longer between generation retries", () => {
    expect(generationRetryDelayMs(1)).toBe(200);
    expect(generationRetryDelayMs(2)).toBe(400);
    expect(generationRetryDelayMs(3)).toBe(800);
  });

  it("stops when every prepared scene is already stored", () => {
    const existingIds = ["b02", "b03"].flatMap((batch) =>
      Array.from({ length: 10 }, (_, index) => `firearm-like-${batch}-${String(index + 1).padStart(2, "0")}`),
    );
    const full = planStillBatch({ ...open, category: "firearm_like", existingIds, capUsd: 50 });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const plan = planStillBatch({ ...open, category: "firearm_like", existingIds: [...existingIds, ...full.scenes.map((scene) => scene.id)], capUsd: 50 });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.reason).toMatch(/already stored/);
  });
});
