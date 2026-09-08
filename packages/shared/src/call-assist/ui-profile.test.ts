import { describe, expect, it } from "vitest";
import {
  buildCallAssistUiProfile,
  cadProviderUiLabel,
  resolveCadPushLabel,
  callAssistCallerIdValue,
  callAssistCadReviewFields,
  callAssistEmergencyAlertTitle,
  callAssistIntakeRows,
  callAssistUiVerticalFromAgency,
  formatMaskedAni,
  formatRetentionPolicyLabel,
  mapCallAssistClassBadge,
  mapCallAssistMonitorState,
} from "./ui-profile.js";
import { MISSOURI_SUNSHINE_RETENTION_POLICY } from "./retention.js";

describe("Call Assist UI profile", () => {
  it("maps agency type to vertical without naming a tenant", () => {
    expect(callAssistUiVerticalFromAgency({ type: "city" })).toBe("911");
    expect(callAssistUiVerticalFromAgency({ type: "campus" })).toBe("campus");
    expect(callAssistUiVerticalFromAgency({ type: "venue" })).toBe("venue");
    expect(callAssistUiVerticalFromAgency({ type: "transit" })).toBe("venue");
    expect(callAssistUiVerticalFromAgency({ type: "city", uiVertical: "campus" })).toBe("campus");
  });

  it("hides CAD for mock and shows PremierOne for Motorola", () => {
    expect(cadProviderUiLabel("mock")).toBeNull();
    expect(cadProviderUiLabel("motorola-premierone")).toBe("PremierOne");
    expect(resolveCadPushLabel("mock", null)).toBeNull();
    expect(resolveCadPushLabel("mock", "TriTech Inform")).toBe("TriTech Inform");
  });

  it("uses ANI masking for 911 and location fragments for campus/venue", () => {
    expect(formatMaskedAni("4821")).toBe("●●●● 4821");
    expect(callAssistCallerIdValue("911", { aniLast4: "3390" })).toBe("●●●● 3390");
    expect(
      callAssistCallerIdValue("campus", { intake: { locationText: "Myers Hall Rm 204" } }),
    ).toBe("Myers Hall Rm 204");
    expect(
      callAssistCallerIdValue("venue", { intake: { locationText: "Sec 114 · Row J · Seat 8" } }),
    ).toBe("Sec 114");
  });

  it("builds vertical-specific emergency titles without a fake pickup line", () => {
    expect(callAssistEmergencyAlertTitle("911")).toBe("Emergency transfer in progress");
    expect(callAssistEmergencyAlertTitle("911", "line 3")).toBe(
      "Emergency transfer in progress — pick up line 3",
    );
    expect(callAssistEmergencyAlertTitle("campus")).toBe("Emergency escalation in progress");
    expect(callAssistEmergencyAlertTitle("venue")).toBe("Emergency escalation in progress");
  });

  it("never hardcodes an agency name in the assembled profile", () => {
    const campus = buildCallAssistUiProfile({
      agencyId: "agency-campus",
      agencyName: "State University Safety",
      agencyType: "campus",
      cadProviderId: "mock",
      role: "dispatcher",
      displayName: "S. Rivera",
      email: "sr@example.edu",
      capabilities: {
        takeover: true,
        cadPush: false,
        forceTransfer: true,
        admin: false,
        records: false,
        demo: false,
        analytics: true,
      },
      externalDirectory: [{ externalAgencyId: "cp", name: "Campus Police", number: "555-0100" }],
    });
    expect(campus.vertical).toBe("campus");
    expect(campus.cadProvider).toBeNull();
    expect(campus.callerIdLabel).toBe("Caller");
    expect(campus.transferTarget).toBe("staff");
    expect(JSON.stringify(campus)).not.toMatch(/KCPD|UGA|Mercedes/i);

    const psap = buildCallAssistUiProfile({
      agencyId: "agency-psap",
      agencyName: "Metro ECC",
      agencyType: "city",
      cadProviderId: "motorola-premierone",
      cadNatureMapping: { EMERGENCY: "ACC-PI" },
      role: "supervisor",
      displayName: "J. Williams",
      capabilities: {
        takeover: true,
        cadPush: true,
        forceTransfer: true,
        admin: true,
        records: true,
        demo: true,
        analytics: true,
      },
      externalDirectory: [],
    });
    expect(psap.vertical).toBe("911");
    expect(psap.cadProvider).toBe("PremierOne");
    expect(psap.cadNatureMapping.EMERGENCY).toBe("ACC-PI");
    expect(psap.callerIdLabel).toBe("ANI");
    expect(psap.userRole).toBe("Supervisor");
    expect(JSON.stringify(psap)).not.toMatch(/KCPD/i);
  });

  it("maps session states and classification badges", () => {
    expect(mapCallAssistMonitorState("TRANSFERRING_911")).toBe("transfer_911");
    expect(mapCallAssistMonitorState("INTAKE")).toBe("ai_active");
    expect(mapCallAssistMonitorState("CALLBACK_QUEUED")).toBe("external");
    expect(mapCallAssistMonitorState("CALLBACK_IN_PROGRESS")).toBe("external");
    expect(mapCallAssistClassBadge("EMERGENCY")).toBe("EMERGENCY");
    expect(mapCallAssistClassBadge("INFORMATION_REQUEST")).toBe("SELF_SERVICE");
    expect(mapCallAssistClassBadge("NOISE_COMPLAINT")).toBe("NON_EMERGENCY");
  });

  it("labels intake by vertical and CAD review without vendor-specific nature invention", () => {
    const rows = callAssistIntakeRows(
      "911",
      {
        locationText: "Main St",
        apartmentSuite: "2A",
        crossStreets: "Main and Oak",
        directionOfTravel: "north",
        injuries: true,
        weaponsMentioned: true,
        weaponsDetail: "knife",
        suspectDescription: "male in a hoodie",
        vehicleMake: "Honda",
        vehicleModel: "Civic",
        vehicleColor: "white",
        vehiclePlate: "XYZ999",
      },
      "EMERGENCY",
    );
    expect(rows.find((r) => r.key === "injuries")?.alert).toBe(true);
    expect(rows.find((r) => r.key === "loc")?.value).toMatch(/2A/);
    expect(rows.find((r) => r.key === "dir")?.value).toBe("north");
    expect(rows.find((r) => r.key === "weapons")?.value).toMatch(/knife/i);
    expect(rows.find((r) => r.key === "vehicle")?.value).toMatch(/Honda/);
    const cad = callAssistCadReviewFields({
      classification: "EMERGENCY",
      natureCode: "ACC-PI",
      location: "I-70",
      callerId: "●●●● 3390",
    });
    expect(cad.find((f) => f.k === "Nature code")?.v).toBe("ACC-PI");
    expect(cad.find((f) => f.k === "CAD type")?.v).toBe("Emergency");
    expect(cad.find((f) => f.k === "Priority")?.highlight).toBe(true);
  });

  it("uses the tenant governing law, not an agency name", () => {
    expect(formatRetentionPolicyLabel(MISSOURI_SUNSHINE_RETENTION_POLICY)).toBe("Missouri Sunshine Law (RSMo 610)");
    expect(
      formatRetentionPolicyLabel({
        ...MISSOURI_SUNSHINE_RETENTION_POLICY,
        displayName: undefined,
        policyName: undefined,
        statute: undefined,
        governingLaw: undefined,
      }),
    ).toBe("Agency retention policy");
    expect(formatRetentionPolicyLabel({ ...MISSOURI_SUNSHINE_RETENTION_POLICY, governingLaw: "FERPA" })).toBe("FERPA");
  });
});
