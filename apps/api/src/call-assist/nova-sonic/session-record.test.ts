import { describe, expect, it } from "vitest";
import { isNovaSessionOpen, novaSessionCloseFields, novaSonicSessionSk } from "./session-record.js";

describe("nova session live GSI helpers", () => {
  it("treats PENDING/ACTIVE as open", () => {
    expect(isNovaSessionOpen("PENDING")).toBe(true);
    expect(isNovaSessionOpen("ACTIVE")).toBe(true);
    expect(isNovaSessionOpen("COMPLETED")).toBe(false);
  });

  it("maps close fields for dashboard GSI", () => {
    expect(novaSessionCloseFields("ACTIVE")).toEqual({
      state: "INTAKE",
      disposition: "ABANDONED",
      open: true,
    });
    expect(novaSessionCloseFields("COMPLETED").open).toBe(false);
    expect(novaSessionCloseFields("EMERGENCY").disposition).toBe("TRANSFERRED");
  });

  it("builds nova session sk", () => {
    expect(novaSonicSessionSk("abc")).toBe("SESSION#nova#abc");
  });
});
