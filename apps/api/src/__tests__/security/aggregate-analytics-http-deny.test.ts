import { describe, expect, it } from "vitest";
import { handler } from "../../handlers/analytics/aggregateAnalytics.js";

describe("aggregateAnalytics handler", () => {
  it("returns 404 if invoked via HTTP API shape (scheduled-only contract)", async () => {
    const res = await handler({
      version: "2.0",
      routeKey: "GET /internal/aggregate",
      rawPath: "/internal/aggregate",
      requestContext: {
        accountId: "123",
        apiId: "abc",
        domainName: "example.com",
        domainPrefix: "api",
        http: {
          method: "GET",
          path: "/internal/aggregate",
          protocol: "HTTP/1.1",
          sourceIp: "127.0.0.1",
          userAgent: "vitest",
        },
        requestId: "req-test",
        routeKey: "GET /internal/aggregate",
        stage: "$default",
        time: "01/Jan/2026:00:00:00 +0000",
        timeEpoch: 1704067200,
      },
      isBase64Encoded: false,
      headers: {},
      body: "",
    } as never);
    expect(res.statusCode).toBe(404);
  });
});
