import { describe, expect, it } from "vitest";
import {
  classifyRampType,
  isRampRelevantText,
  RAMP_SIGNAL_SCORES,
} from "../ramp-keywords.js";
import {
  isRampSpaShell,
  parseRampHtml,
  RAMP_DETAIL_PREFIX,
} from "../../../handlers/rapid-iq/collectors/ramp-collector.js";
import { scoreOpportunity } from "../opportunity-scorer.js";

describe("ramp-keywords", () => {
  it("accepts security / technology language", () => {
    expect(isRampRelevantText("Venue Security Platform", "crowd management and incident reporting")).toBe(
      true,
    );
    expect(isRampRelevantText("Software for communications", "emergency notification")).toBe(true);
  });

  it("excludes food / catering", () => {
    expect(isRampRelevantText("Olympic catering services", "food and beverage for athletes")).toBe(
      false,
    );
  });

  it("classifies solicitation types", () => {
    expect(classifyRampType("Request for Proposal — Security")).toBe("RFP");
    expect(classifyRampType("EOI for technology")).toBe("EOI");
    expect(classifyRampType("RFQ software")).toBe("RFQ");
  });

  it("scores RFP/RFQ into ACT NOW via opportunity scorer", () => {
    const rfp = scoreOpportunity({
      scoreContrib: RAMP_SIGNAL_SCORES.RFP!,
      intentStage: "active_rfp",
    });
    expect(rfp.isActNow).toBe(true);

    const rfq = scoreOpportunity({
      scoreContrib: RAMP_SIGNAL_SCORES.RFQ!,
      intentStage: "evaluation",
    });
    expect(rfq.isActNow).toBe(true);

    const eoi = scoreOpportunity({
      scoreContrib: RAMP_SIGNAL_SCORES.EOI!,
      intentStage: "evaluation",
    });
    expect(eoi.isActNow).toBe(false);
  });
});

describe("parseRampHtml", () => {
  it("returns empty for Salesforce Experience Cloud guest shell", () => {
    const shell = `<!DOCTYPE html><html><head><title>RAMP</title>
      <link class="auraCss" href="/css"/>
      <div class="auraMsgBox auraLoadingBox"><div class="logo"></div></div>
      <div id="auraErrorBox"></div>
      Bid Opportunities Status Open Type Request for Proposal
      </html>`;
    expect(isRampSpaShell(shell)).toBe(true);
    expect(parseRampHtml(shell, "security", "Security")).toEqual([]);
  });

  it("extracts opportunity-details links", () => {
    const html = `
      <div class="listing">
        <a href="/s/opportunity-details?id=006abcXYZ123456789">Security Technology Platform EOI</a>
        Bid Due Date: Sep 30, 2026 Category Security Status Open Type Expression of Interest
      </div>`;
    expect(isRampSpaShell(html)).toBe(false);
    const opps = parseRampHtml(html, "security", "Security");
    expect(opps.length).toBeGreaterThanOrEqual(1);
    expect(opps[0]!.title).toContain("Security Technology");
    expect(opps[0]!.url).toContain(`${RAMP_DETAIL_PREFIX}?id=006`);
    expect(opps[0]!.type).toBe("EOI");
  });

  it("extracts embedded JSON opportunity rows", () => {
    const html = `<html><script type="application/json">
      {"records":[{"Name":"Venue Safety Software RFP","Type":"RFP","Status":"Open","Id":"006jsonRFP000000001","Description":"public safety software for venues"}]}
    </script></html>`;
    const opps = parseRampHtml(html, "software", "Technology");
    expect(opps.some((o) => /Venue Safety/i.test(o.title) && o.type === "RFP")).toBe(true);
  });
});
