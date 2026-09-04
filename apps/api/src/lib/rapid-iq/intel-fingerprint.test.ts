import { describe, expect, it } from "vitest";
import { intelFingerprint } from "./intel-fingerprint.js";

describe("intelFingerprint", () => {
  it("hashes agency + solicitation + normalized title + due date", () => {
    const a = intelFingerprint({
      agency: "WMATA",
      solicitationNumber: "R-1",
      title: "CAD Overlay",
      dueDate: "2026-12-01",
    });
    const b = intelFingerprint({
      agency: "wmata",
      solicitationNumber: "R-1",
      title: "cad   overlay",
      dueDate: "2026-12-01",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });
});
