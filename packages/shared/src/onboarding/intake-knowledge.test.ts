import { describe, expect, it } from "vitest";
import { campusIntakeSchema } from "./campus-intake-schema.js";
import { transitIntakeSchema } from "./transit-intake-schema.js";
import { venueIntakeSchema } from "./venue-intake-schema.js";

const venueBase = {
  venueName: "Mercedes-Benz Stadium",
  legalEntityName: "AMB Group",
  state: "GA",
  venueCapacity: 71000,
  eventFrequency: "year_round" as const,
  securityStaffingModel: "hybrid" as const,
  securityDispatchContactName: "Ops Desk",
  securityDispatchContactNumber: "5550100100",
  guestServicesContactName: "Guest Services",
  guestServicesContactEmail: "gs@example.com",
  adaCoordinatorName: "ADA Lead",
  adaCoordinatorEmail: "ada@example.com",
  existingSecurityCommsTools: ["radio" as const],
  guestServicesReceiveReports: true,
  sectionZoneCount: 12,
  nfcTagsNeeded: "yes" as const,
  signInstaller: "venue_ops" as const,
  eventCodesAutoExpire: true,
  dataRetentionPreference: "3yr" as const,
};

const campusBase = {
  orgName: "Lincoln High",
  legalName: "Lincoln High School",
  state: "GA",
  primaryDomain: "lincolnhigh.edu",
  studentPopulation: 1200,
  securityDepartmentName: "Campus Safety",
  dispatchNumber24x7: "5550100200",
  securityDirectorName: "Director",
  securityDirectorEmail: "safety@example.com",
  titleIxCleryContactName: "Clery",
  titleIxCleryContactEmail: "clery@example.com",
  existingReportingTools: "Anonymous tip line",
  anonymousReportingPolicy: "allow" as const,
  preferredSmsKeyword: "LINCOLN",
  academicCalendarType: "semester" as const,
  estimatedSignLocations: 40,
  nfcTagsNeeded: "yes" as const,
  signInstaller: "facilities" as const,
  studentCommsChannel: "email" as const,
  dataRetentionPreference: "3yr" as const,
};

describe("vertical intake Guest Assist knowledge", () => {
  it("accepts existing venue and campus intakes without knowledge fields", () => {
    expect(venueIntakeSchema.parse(venueBase).guestAssistKnowledge.directions).toBe("");
    expect(campusIntakeSchema.parse(campusBase).guestAssistKnowledge.safety).toBe("");
  });

  it("stores category facts on all three verticals", () => {
    const venue = venueIntakeSchema.parse({
      ...venueBase,
      guestAssistKnowledge: { directions: "Gate C restrooms" },
    });
    expect(venue.guestAssistKnowledge.directions).toBe("Gate C restrooms");

    const campus = campusIntakeSchema.parse({
      ...campusBase,
      guestAssistKnowledge: { safety: "Safe walk 555-0100" },
    });
    expect(campus.guestAssistKnowledge.safety).toBe("Safe walk 555-0100");

    const transit = transitIntakeSchema.parse({
      agencyName: "Harbor Valley Transit",
      legalName: "HVT Authority",
      state: "GA",
      operationsContactName: "Control",
      operationsContactNumber: "5550100300",
      guestAssistKnowledge: { fares: "Single ride $2.50" },
    });
    expect(transit.guestAssistKnowledge.fares).toBe("Single ride $2.50");
    expect(transit.guestAssistKnowledge.schedules).toBe("");
  });
});
