import { describe, expect, it } from "vitest";
import {
  isPersonalSalesMailboxShared,
  salesOutlookCallbackBodySchema,
  salesSendEmailRequestSchema,
} from "./sales-outlook-schemas.js";

describe("isPersonalSalesMailboxShared", () => {
  it("allows @nexcortiq.us only", () => {
    expect(isPersonalSalesMailboxShared("rep@nexcortiq.us")).toBe(true);
    expect(isPersonalSalesMailboxShared("Rep@NexCortiQ.us")).toBe(true);
    expect(isPersonalSalesMailboxShared("jeff@nexcortiq.us")).toBe(true);
    expect(isPersonalSalesMailboxShared("sales@appondemand.net")).toBe(false);
    expect(isPersonalSalesMailboxShared("user@gmail.com")).toBe(false);
    expect(isPersonalSalesMailboxShared("nexcortiq.us@evil.com")).toBe(false);
  });
});

describe("salesSendEmailRequestSchema", () => {
  it("requires to, subject, body", () => {
    expect(
      salesSendEmailRequestSchema.safeParse({
        to: "director@agency.gov",
        subject: "Hello",
        body: "Body text",
      }).success,
    ).toBe(true);
    expect(salesSendEmailRequestSchema.safeParse({ to: "x", subject: "a", body: "b" }).success).toBe(
      false,
    );
  });

  it("accepts empty cc and validates non-empty cc", () => {
    expect(
      salesSendEmailRequestSchema.safeParse({
        to: "a@b.co",
        subject: "S",
        body: "B",
        cc: "",
      }).success,
    ).toBe(true);
    expect(
      salesSendEmailRequestSchema.safeParse({
        to: "a@b.co",
        subject: "S",
        body: "B",
        cc: "not-an-email",
      }).success,
    ).toBe(false);
  });
});

describe("salesOutlookCallbackBodySchema", () => {
  it("requires code and state", () => {
    expect(salesOutlookCallbackBodySchema.safeParse({}).success).toBe(false);
    expect(
      salesOutlookCallbackBodySchema.parse({ code: "abc", state: "signed.state" }),
    ).toEqual({ code: "abc", state: "signed.state" });
  });
});
