import { describe, expect, it } from "vitest";
import { handler as silentTextPublicHandler } from "./silentTextPublicHttp.js";
import { handler as videoAssistPublicHandler } from "./videoAssistPublicHttp.js";
import { getIncidentMediaPublicMetaHandler } from "./media/getUploadUrl.js";
import { invokeHttpHandler } from "./handlerTestUtils.js";

describe("public token route guards", () => {
  it("rejects missing token for silent text public route", async () => {
    const res = await invokeHttpHandler(silentTextPublicHandler, {
      version: "2.0",
      routeKey: "GET /api/silent-text/t/{token}",
      rawPath: "/api/silent-text/t/",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects malformed token for video assist public route", async () => {
    const res = await invokeHttpHandler(videoAssistPublicHandler, {
      version: "2.0",
      routeKey: "GET /api/video-assist/t/{token}",
      rawPath: "/api/video-assist/t/invalid",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      pathParameters: { token: "bad token" },
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects malformed token for incident media metadata route", async () => {
    const res = await getIncidentMediaPublicMetaHandler({
      version: "2.0",
      routeKey: "GET /api/public/incident-media/t/{token}",
      rawPath: "/api/public/incident-media/t/invalid",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      pathParameters: { token: "short" },
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(404);
  });
});
