import { describe, expect, it } from "vitest";
import {
  buildSignalEditionSubject,
  getPublishedSignalEditions,
  getSignalEditionsForSalesSync,
  isNewsletterCampaignId,
  SIGNAL_EDITIONS,
  signalEditionCampaignId,
  signalEditionDraftId,
  signalEditionUrl,
} from "./signal-editions.js";

describe("signal editions catalog", () => {
  it("exposes at least the November published edition", () => {
    const published = getPublishedSignalEditions();
    expect(published.length).toBeGreaterThanOrEqual(1);
    expect(published.some((e) => e.slug === "vol1-no1-introduction")).toBe(true);
    expect(published.every((e) => e.status === "published")).toBe(true);
  });

  it("syncs all Vol. 1 editions into Sales Automation for approval", () => {
    const forSales = getSignalEditionsForSalesSync();
    expect(forSales.length).toBe(SIGNAL_EDITIONS.length);
    expect(forSales.length).toBe(12);
    expect(forSales.map((e) => e.slug)).toContain("vol1-no12-year-in-review");
  });

  it("builds stable draft and campaign ids", () => {
    expect(signalEditionDraftId("vol1-no1-introduction")).toBe("nl-vol1-no1-introduction");
    expect(signalEditionCampaignId("vol1-no1-introduction")).toBe(
      "newsletter:vol1-no1-introduction",
    );
    expect(signalEditionUrl("vol1-no1-introduction")).toContain(
      "/newsletter/vol1-no1-introduction/",
    );
  });

  it("treats newsletter and newsletter:slug as Signal campaigns", () => {
    expect(isNewsletterCampaignId("newsletter")).toBe(true);
    expect(isNewsletterCampaignId("newsletter:vol1-no1-introduction")).toBe(true);
    expect(isNewsletterCampaignId("budget-season")).toBe(false);
  });

  it("builds a readable subject", () => {
    const edition = getPublishedSignalEditions()[0]!;
    expect(buildSignalEditionSubject(edition)).toContain("NexCortiQ Signal");
    expect(buildSignalEditionSubject(edition)).toContain(edition.title);
  });
});
