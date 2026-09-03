import { describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const { handleLink, handleVerify } = vi.hoisted(() => ({
  handleLink: vi.fn(async () => ({ statusCode: 200, body: "link" })),
  handleVerify: vi.fn(async () => ({ statusCode: 200, body: "verify" })),
}));

vi.mock("./homeowner-link.js", () => ({ handler: handleLink }));
vi.mock("./homeowner-verify.js", () => ({ handler: handleVerify }));

describe("homeowner-public router", () => {
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
