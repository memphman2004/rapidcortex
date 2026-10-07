import { describe, it, expect } from "vitest";
import { handler as postOverride } from "./postAgencyAdminAccessOverrides.js";
import { handler as listOverrides } from "./listAgencyAdminAccessOverrides.js";
import { handler as patchRevoke } from "./patchAgencyAdminAccessOverrideRevoke.js";
import { handler as getOverride } from "./getAgencyAdminAccessOverride.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

describe("agency admin access overrides HTTP denylist", () => {
  const dispatcherEvent = (
    overrides: Partial<Parameters<typeof makeAuthenticatedEvent>[0]> = {},
    body?: Record<string, unknown>,
  ) =>
    makeAuthenticatedEvent({
      role: "dispatcher",
      agencyId: "agency-a",
      userId: "disp-1",
      email: "disp@agency-a.example",
      rawPath: "/api/agency-admin/overrides",
      routeKey: "GET /api/agency-admin/overrides",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...overrides,
    });

  it("dispatchers receive 403 on POST create", async () => {
    const res = await invokeHttpHandler(
      postOverride,
      dispatcherEvent(
        {
          routeKey: "POST /api/agency-admin/overrides",
          rawPath: "/api/agency-admin/overrides",
        },
        {
          targetUserId: "some-target-user-sub",
          overrideType: "feature",
          grantedRoleOrPermission: "feature:silent_text",
          reason: "Should not authorize non-admin roles",
        },
      ),
    );
    expect(res.statusCode).toBe(403);
    const parsed = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(parsed.error).toContain("Forbidden");
  });

  it("dispatchers receive 403 on GET list", async () => {
    const res = await invokeHttpHandler(
      listOverrides,
      dispatcherEvent({
        routeKey: "GET /api/agency-admin/overrides",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("dispatchers receive 403 on PATCH revoke", async () => {
    const res = await invokeHttpHandler(
      patchRevoke,
      dispatcherEvent({
        routeKey: "PATCH /api/agency-admin/overrides/foo/revoke",
        rawPath: "/api/agency-admin/overrides/foo/revoke",
        pathParameters: { overrideId: "foo" },
        body: JSON.stringify({ reason: "Unauthorized role should not revoke" }),
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("dispatchers receive 403 on GET single", async () => {
    const res = await invokeHttpHandler(
      getOverride,
      dispatcherEvent({
        routeKey: "GET /api/agency-admin/overrides/foo",
        rawPath: "/api/agency-admin/overrides/foo",
        pathParameters: { overrideId: "foo" },
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
