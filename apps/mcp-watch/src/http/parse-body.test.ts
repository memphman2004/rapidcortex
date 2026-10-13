import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { lambdaBodyParser } from "./parse-body.js";

function mockReq(): Request {
  return { headers: {}, body: undefined } as unknown as Request;
}

describe("lambdaBodyParser", () => {
  it("parses JSON from Function URL event", async () => {
    const parser = lambdaBodyParser(() => ({
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", id: 1 }),
      isBase64Encoded: false,
      headers: { "content-type": "application/json" },
    }));
    const req = mockReq();
    const next = vi.fn();
    parser(req, {} as Response, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toMatchObject({ method: "tools/call" });
  });

  it("parses urlencoded for oauth token", () => {
    const parser = lambdaBodyParser(() => ({
      body: "grant_type=authorization_code&code=abc",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }));
    const req = mockReq();
    parser(req, {} as Response, vi.fn());
    expect(req.body).toMatchObject({ grant_type: "authorization_code", code: "abc" });
  });
});
