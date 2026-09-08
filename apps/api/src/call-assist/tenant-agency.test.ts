import { describe, expect, it } from "vitest";
import {
  isPlatformCallAssistTenant,
  requestedCallAssistAgencyId,
  resolveCallAssistTenantAgencyId,
  callAssistAgencyQueryForbidden,
} from "./tenant-agency.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

function event(opts: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /api/call-assist/sessions",
    rawPath: "/api/call-assist/sessions",
    rawQueryString: "",
    headers: opts.headers ?? {},
    queryStringParameters: opts.query,
    requestContext: { http: { method: "GET", path: "/api/call-assist/sessions" } } as APIGatewayProxyEventV2["requestContext"],
    isBase64Encoded: false,
  };
}

describe("resolveCallAssistTenantAgencyId", () => {
  it("lets RC operators switch into a requested tenant", () => {
    expect(
      resolveCallAssistTenantAgencyId({ role: "rcsuperadmin", agencyId: "__platform__" }, "kcpd"),
    ).toBe("kcpd");
    expect(
      resolveCallAssistTenantAgencyId({ role: "rcadmin", agencyId: "__platform__" }, "uga"),
    ).toBe("uga");
    expect(
      resolveCallAssistTenantAgencyId({ role: "rcitadmin", agencyId: "__platform__" }, "mbs"),
    ).toBe("mbs");
  });

  it("ignores requested agencyId for customer roles", () => {
    expect(
      resolveCallAssistTenantAgencyId({ role: "dispatcher", agencyId: "kcpd" }, "other-agency"),
    ).toBe("kcpd");
    expect(
      resolveCallAssistTenantAgencyId({ role: "agencyadmin", agencyId: "kcpd" }, "other-agency"),
    ).toBe("kcpd");
    expect(
      resolveCallAssistTenantAgencyId({ role: "CAMPUS_ADMIN", agencyId: "uga" }, "kcpd"),
    ).toBe("uga");
  });

  it("falls back to JWT agency when RC omits or sends the platform sentinel", () => {
    expect(
      resolveCallAssistTenantAgencyId({ role: "rcadmin", agencyId: "__platform__" }, ""),
    ).toBe("__platform__");
    expect(
      resolveCallAssistTenantAgencyId({ role: "rcadmin", agencyId: "__platform__" }, "__platform__"),
    ).toBe("__platform__");
  });

  it("forbids customer roles from requesting a different tenant", () => {
    expect(callAssistAgencyQueryForbidden({ role: "dispatcher", agencyId: "kcpd" }, "uga-campus")).toBe(true);
    expect(callAssistAgencyQueryForbidden({ role: "agencyadmin", agencyId: "kcpd" }, "other-agency")).toBe(true);
    expect(callAssistAgencyQueryForbidden({ role: "dispatcher", agencyId: "kcpd" }, "kcpd")).toBe(false);
    expect(callAssistAgencyQueryForbidden({ role: "dispatcher", agencyId: "kcpd" }, "")).toBe(false);
    expect(callAssistAgencyQueryForbidden({ role: "rcadmin", agencyId: "__platform__" }, "uga")).toBe(false);
    expect(callAssistAgencyQueryForbidden({ role: "rcsuperadmin", agencyId: "__platform__" }, "kcpd")).toBe(false);
  });

  it("reads agencyId from query first, then x-rc-agency-id", () => {
    expect(requestedCallAssistAgencyId(event({ query: { agencyId: "kcpd" } }))).toBe("kcpd");
    expect(
      requestedCallAssistAgencyId(event({ headers: { "X-Rc-Agency-Id": "uga" } })),
    ).toBe("uga");
    expect(isPlatformCallAssistTenant("__platform__")).toBe(true);
  });
});
