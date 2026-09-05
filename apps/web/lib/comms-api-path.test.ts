import { afterEach, describe, expect, it } from "vitest";
import {
  isCommsPlatformApiPath,
  isSam3ApiPath,
  isSam4ApiPath,
  isSam5ApiPath,
  isStack2ApiPath,
  resolveUpstreamApiBase,
} from "./comms-api-path";

describe("resolveUpstreamApiBase", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("routes billing to stack 4 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    process.env.API_UPSTREAM_BASE_4 = "https://stack4.example.com";
    process.env.API_UPSTREAM_BASE_5 = "https://stack5.example.com";
    expect(resolveUpstreamApiBase("/api/billing/plans")).toBe("https://stack4.example.com");
  });

  it("routes campus to stack 5 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_5 = "https://stack5.example.com";
    expect(resolveUpstreamApiBase("/api/campus/incidents")).toBe("https://stack5.example.com");
  });

  it("routes call-intelligence to stack 2 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(resolveUpstreamApiBase("/api/call-intelligence/languages")).toBe(
      "https://stack2.example.com",
    );
  });

  it("routes agency-admin to stack 3 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(resolveUpstreamApiBase("/api/agency-admin/clients")).toBe(
      "https://stack3.example.com",
    );
  });

  it("does not fall back to stack 1 when stack 2 is unset", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    delete process.env.API_UPSTREAM_BASE_2;
    expect(resolveUpstreamApiBase("/api/call-intelligence/languages")).toBe("");
  });

  it("uses stack 1 for non-comms paths", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    delete process.env.API_UPSTREAM_BASE_2;
    expect(resolveUpstreamApiBase("/api/incidents")).toBe("https://stack1.example.com");
  });

  it("strips a trailing /api from upstream bases so BFF paths do not double", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com/api";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com/api/";
    expect(resolveUpstreamApiBase("/api/agencies")).toBe("https://stack1.example.com");
    expect(resolveUpstreamApiBase("/api/platform/summary")).toBe("https://stack3.example.com");
  });

  it("routes qr-nfc to stack 1 (AppSamQrStack on primary HttpApi)", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(resolveUpstreamApiBase("/api/qr-nfc")).toBe("https://stack1.example.com");
    expect(resolveUpstreamApiBase("/api/public/report")).toBe("https://stack1.example.com");
    expect(isStack2ApiPath("/api/qr-nfc")).toBe(false);
  });

  it("routes rc-admin usage to stack 2 (not stack 3)", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(resolveUpstreamApiBase("/api/rc-admin/usage")).toBe("https://stack2.example.com");
    expect(resolveUpstreamApiBase("/api/rc-admin/usage/export")).toBe("https://stack2.example.com");
    expect(resolveUpstreamApiBase("/api/rc-admin/api-clients")).toBe("https://stack3.example.com");
    expect(resolveUpstreamApiBase("/api/rc-admin/agreements")).toBe("https://stack3.example.com");
    expect(resolveUpstreamApiBase("/api/rc-admin/leads")).toBe("https://stack3.example.com");
    expect(resolveUpstreamApiBase("/api/rc-admin/leads/abc")).toBe("https://stack3.example.com");
  });

  it("routes triage queue to stack 1 (primary AppSamStack)", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(resolveUpstreamApiBase("/api/triage/queue")).toBe("https://stack1.example.com");
    expect(isStack2ApiPath("/api/triage/queue")).toBe(false);
  });
});

describe("isCommsPlatformApiPath", () => {
  it("matches billing prefix (stack 4)", () => {
    expect(isSam4ApiPath("/api/billing/plans")).toBe(true);
    expect(isSam4ApiPath("/api/public/ring/oauth/start")).toBe(true);
    expect(isSam4ApiPath("/api/public/ring/homeowner/delete-account")).toBe(true);
    expect(isSam4ApiPath("/api/user/account")).toBe(true);
    expect(isStack2ApiPath("/api/billing/plans")).toBe(false);
  });

  it("matches hospitals prefix (stack 2)", () => {
    expect(isStack2ApiPath("/api/hospitals/prealerts")).toBe(true);
  });

  it("matches transit prefix (stack 2)", () => {
    expect(isStack2ApiPath("/api/transit/test-transit-hvt/dashboard")).toBe(true);
    expect(isSam5ApiPath("/api/transit/test-transit-hvt/dashboard")).toBe(false);
  });

  it("matches campus prefix (stack 5)", () => {
    expect(isSam5ApiPath("/api/campus/analytics")).toBe(true);
    expect(isSam3ApiPath("/api/campus/analytics")).toBe(false);
  });

  it("matches call-intelligence prefix", () => {
    expect(isCommsPlatformApiPath("/api/call-intelligence/languages")).toBe(true);
  });

  it("matches onboarding packets on stack 3", () => {
    expect(isSam3ApiPath("/api/admin/onboarding-packets")).toBe(true);
    expect(isSam3ApiPath("/api/admin/onboarding-packets/download")).toBe(true);
    expect(isSam5ApiPath("/api/admin/onboarding-packets")).toBe(false);
  });

  it("matches marketing lead + unsubscribe (stack 3)", () => {
    expect(isSam3ApiPath("/api/marketing/lead")).toBe(true);
    expect(isSam3ApiPath("/api/marketing/unsubscribe")).toBe(true);
    expect(isStack2ApiPath("/api/marketing/lead")).toBe(false);
  });

  it("does not match incident list", () => {
    expect(isCommsPlatformApiPath("/api/incidents")).toBe(false);
  });

  it("keeps integration status on stack 1 (handler lives on AppSamStack)", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(isStack2ApiPath("/api/integration/status")).toBe(false);
    expect(resolveUpstreamApiBase("/api/integration/status")).toBe("https://stack1.example.com");
  });

  it("routes war-rooms and hospital portal paths to stack 2", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(resolveUpstreamApiBase("/api/war-rooms")).toBe("https://stack2.example.com");
    expect(resolveUpstreamApiBase("/api/hospital-portal/context")).toBe("https://stack2.example.com");
    expect(resolveUpstreamApiBase("/api/hospitals/capacity")).toBe("https://stack2.example.com");
  });

  it("routes RCS (Response Continuity System) paths to stack 2", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(isStack2ApiPath("/api/rcs/calls")).toBe(true);
    expect(resolveUpstreamApiBase("/api/rcs/calls")).toBe("https://stack2.example.com");
    expect(resolveUpstreamApiBase("/api/rcs/calls/call-1/supervisor-ack")).toBe(
      "https://stack2.example.com",
    );
  });

  it("routes hiring ATS paths to stack 3", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(isSam3ApiPath("/api/rc-admin/job-postings")).toBe(true);
    expect(isSam3ApiPath("/api/rc-admin/applications")).toBe(true);
    expect(isSam3ApiPath("/api/rc-admin/applications/abc/notes")).toBe(true);
    expect(isSam3ApiPath("/api/rc-admin/settings/hiring-bookings")).toBe(true);
    expect(resolveUpstreamApiBase("/api/rc-admin/applications")).toBe("https://stack3.example.com");
  });

  it("routes grant-writer to stack 3", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(isSam3ApiPath("/api/rc-admin/grant-writer/generate")).toBe(true);
    expect(resolveUpstreamApiBase("/api/rc-admin/grant-writer/generate")).toBe(
      "https://stack3.example.com",
    );
  });

  it("routes conferences to stack 3", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(isSam3ApiPath("/api/rc-admin/conferences")).toBe(true);
    expect(isSam3ApiPath("/api/rc-admin/conferences/conf-apco-2026")).toBe(true);
    expect(resolveUpstreamApiBase("/api/rc-admin/conferences")).toBe("https://stack3.example.com");
  });

  it("routes venue push-subscription to stack 3 (escalation), not stack 5", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    process.env.API_UPSTREAM_BASE_5 = "https://stack5.example.com";
    expect(isSam5ApiPath("/api/venue/push-subscription")).toBe(false);
    expect(isSam3ApiPath("/api/venue/push-subscription")).toBe(true);
    expect(resolveUpstreamApiBase("/api/venue/push-subscription")).toBe(
      "https://stack3.example.com",
    );
    expect(resolveUpstreamApiBase("/api/venue/incidents")).toBe("https://stack5.example.com");
  });

  it("routes RMS paths to stack 3", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(isSam3ApiPath("/api/rms/reports")).toBe(true);
    expect(resolveUpstreamApiBase("/api/rms/reports/generate")).toBe("https://stack3.example.com");
    expect(resolveUpstreamApiBase("/api/rms/context")).toBe("https://stack3.example.com");
  });

  it("routes language-session to stack 2 and audio-chunks to stack 1", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(resolveUpstreamApiBase("/api/incidents/inc-1/language-session/start")).toBe(
      "https://stack2.example.com",
    );
    expect(resolveUpstreamApiBase("/api/incidents/inc-1/voice-bridge/outbound")).toBe(
      "https://stack2.example.com",
    );
    expect(resolveUpstreamApiBase("/api/incidents/inc-1/audio-chunks")).toBe(
      "https://stack1.example.com",
    );
  });
});
