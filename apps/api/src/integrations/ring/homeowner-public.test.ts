import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const { handleLink, handleVerify, handleDelete } = vi.hoisted(() => ({
  handleLink: vi.fn(async () => ({ statusCode: 200, body: "link" })),
  handleVerify: vi.fn(async () => ({ statusCode: 200, body: "verify" })),
  handleDelete: vi.fn(async () => ({ statusCode: 200, body: "delete" })),
}));

vi.mock("./homeowner-link.js", () => ({ handler: handleLink }));
vi.mock("./homeowner-verify.js", () => ({ handler: handleVerify }));
vi.mock("./homeowner-delete.js", () => ({ handler: handleDelete }));

describe("homeowner-public router", () => {
  beforeEach(() => {
    handleLink.mockClear();
    handleVerify.mockClear();
    handleDelete.mockClear();
  });

  it("sends POST /delete-account to the deletion handler", async () => {
    const { handler } = await import("./homeowner-public.js");
    const event = {
      rawPath: "/api/public/ring/homeowner/delete-account",
      requestContext: { http: { method: "POST", path: "/api/public/ring/homeowner/delete-account" } },
    } as APIGatewayProxyEventV2;
    const res = await handler(event, {} as never, () => undefined);
    expect(res).toMatchObject({ body: "delete" });
    expect(handleDelete).toHaveBeenCalledOnce();
    expect(handleLink).not.toHaveBeenCalled();
  });

  it("sends GET /verify to the email-verify handler", async () => {
    const { handler } = await import("./homeowner-public.js");
    const event = {
      rawPath: "/api/public/ring/homeowner/verify",
      requestContext: { http: { method: "GET", path: "/api/public/ring/homeowner/verify" } },
    } as APIGatewayProxyEventV2;
    const res = await handler(event, {} as never, () => undefined);
    expect(res).toMatchObject({ body: "verify" });
    expect(handleVerify).toHaveBeenCalledOnce();
    expect(handleLink).not.toHaveBeenCalled();
  });

  it("sends POST /link to the signup handler", async () => {
    const { handler } = await import("./homeowner-public.js");
    const event = {
      rawPath: "/api/public/ring/homeowner/link",
      requestContext: { http: { method: "POST", path: "/api/public/ring/homeowner/link" } },
    } as APIGatewayProxyEventV2;
    const res = await handler(event, {} as never, () => undefined);
    expect(res).toMatchObject({ body: "link" });
    expect(handleLink).toHaveBeenCalledOnce();
  });
});
