import { describe, expect, it } from "vitest";
import { WORKSTATION_PANELS } from "./workstation-prefs";

describe("workstation layout prefs", () => {
  it("includes every operational panel key used by CAD", () => {
    expect(WORKSTATION_PANELS).toEqual(
      expect.arrayContaining([
        "transcript",
        "intelligence",
        "map",
        "caller_mobile",
        "silent_text",
        "pinpoint",
        "cad_entry",
        "premise_notes",
        "ng911_assist",
        "supervisor_assist",
        "actions",
        "location",
        "share",
      ]),
    );
  });
});
