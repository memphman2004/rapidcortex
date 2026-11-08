import { describe, expect, it } from "vitest";
import {
  emailListVerticalToLeadVertical,
  leadVerticalToEmailListVertical,
  mapApolloTitleToVertical,
} from "./marketing-vertical.js";

describe("marketing vertical maps", () => {
  it("round-trips email-list ↔ lead verticals", () => {
    expect(leadVerticalToEmailListVertical("law_enforcement")).toBe("LAW_ENFORCEMENT");
    expect(leadVerticalToEmailListVertical("fire_ems")).toBe("FIRE_EMS");
    expect(emailListVerticalToLeadVertical("FIRE_EMS")).toBe("fire_ems");
    expect(leadVerticalToEmailListVertical("unknown")).toBe("PSAP");
  });

  it("maps Apollo titles", () => {
    expect(mapApolloTitleToVertical("Fire Chief", "Springfield FD")).toBe("fire_ems");
    expect(mapApolloTitleToVertical("Chief of Police", "KCMO PD")).toBe("law_enforcement");
    expect(mapApolloTitleToVertical("PSAP Director", "County ECC")).toBe("rc911");
    expect(mapApolloTitleToVertical("Campus Security Director", "State U")).toBe("campus");
  });
});
