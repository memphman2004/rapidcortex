import { describe, expect, it } from "vitest";
import { classifyRekognitionLabels } from "rapid-cortex-shared";

describe("scene classify mapping used by the worker", () => {
  it("drops frames that are motion only", () => {
    expect(classifyRekognitionLabels([{ name: "Building", confidence: 99, instances: 1 }])).toBeNull();
  });

  it("classifies person-down mock labels used by the sampler", () => {
    const result = classifyRekognitionLabels([
      { name: "Person", confidence: 97, instances: 1 },
      { name: "Person Down", confidence: 88, instances: 1 },
    ]);
    expect(result?.eventType).toBe("PERSON_DOWN");
    expect(result?.severity).toBe("critical");
  });
});
