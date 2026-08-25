import { describe, expect, it } from "vitest";
import {
  AGENDA_URL_PATTERNS,
  DEFAULT_PROCUREMENT_PATHS,
  collectDocumentLinksFromHtml,
  isProcurementListingPath,
  isProcurementOrAgendaHref,
  publicSafetyDocumentScore,
  resolveCrawlPathHints,
} from "../agenda-finder.js";
import { ALL_JURISDICTIONS } from "../jurisdiction-registry.js";

const MACON_RFP_HREF =
  "/27-006-lh-next-generation-9-1-1-esinet-and-public-safety-communications-modernization-8-27-26/";

describe("agenda-finder procurement links", () => {
  it("matches county NG911 / ESInet RFP slugs, not generic nav", () => {
    expect(isProcurementOrAgendaHref(MACON_RFP_HREF)).toBe(true);
    expect(isProcurementOrAgendaHref("/bids/")).toBe(true);
    expect(isProcurementOrAgendaHref("/about-the-mayor")).toBe(false);
    expect(isProcurementOrAgendaHref("mailto:lhardwick@maconbibb.us")).toBe(false);
  });

  it("recognizes county purchasing listing paths", () => {
    expect(isProcurementListingPath("https://www.maconbibb.us/bids")).toBe(true);
    expect(isProcurementListingPath("/purchasing/current-solicitations")).toBe(true);
    expect(isProcurementListingPath("/commission/agendas")).toBe(false);
  });

  it("extracts the Macon-Bibb NG911 ESInet RFP ahead of unrelated bid PDFs", () => {
    const html = `
      <a href="/27-010-lh-debris-removal-services.pdf">Debris</a>
      <a href="/27-004-lh-facilities-maintenance.pdf">Facilities</a>
      <a href="${MACON_RFP_HREF}">27-006-LH Next Generation 9-1-1 ESInet</a>
      <p>Request for Proposal — Next Generation 9-1-1 ESInet and Public Safety Communications</p>
    `;
    const docs = collectDocumentLinksFromHtml(
      html,
      "https://www.maconbibb.us",
      "Macon-Bibb County",
      "2026-08-16T00:00:00.000Z",
      "https://www.maconbibb.us/bids",
    );
    expect(docs.some((d) => d.url.includes("9-1-1-esinet"))).toBe(true);
    expect(docs[0]?.url).toContain("9-1-1-esinet");
    expect(publicSafetyDocumentScore(docs[0]!)).toBeGreaterThan(
      publicSafetyDocumentScore({
        url: "https://www.maconbibb.us/27-010-lh-debris-removal-services.pdf",
        title: "Debris",
        publishedAt: "2026-08-16T00:00:00.000Z",
      }),
    );
  });

  it("picks NG911 RFPs from listing link text even when the href is opaque", () => {
    const html = `
      <a href="/node/49821">RFP 27-006 Next Generation 9-1-1 ESInet modernization</a>
      <a href="/node/49800">Debris Removal Services RFP</a>
    `;
    const onBids = collectDocumentLinksFromHtml(
      html,
      "https://examplecounty.gov",
      "Example County",
      "2026-08-16T00:00:00.000Z",
      "https://examplecounty.gov/bids",
    );
    expect(onBids[0]?.url).toContain("/node/49821");
    expect(onBids[0]?.title).toMatch(/9-1-1/i);

    const onAbout = collectDocumentLinksFromHtml(
      html,
      "https://examplecounty.gov",
      "Example County",
      "2026-08-16T00:00:00.000Z",
      "https://examplecounty.gov/about",
    );
    expect(onAbout.some((d) => d.url.includes("/node/49821"))).toBe(false);
  });

  it("keeps procurement paths on DEFAULT_PROCUREMENT_PATHS, not agenda-only patterns", () => {
    expect(DEFAULT_PROCUREMENT_PATHS).toEqual(
      expect.arrayContaining(["/bids", "/procurement", "/purchasing"]),
    );
    expect(AGENDA_URL_PATTERNS).not.toContain("/bids");
  });
});

describe("resolveCrawlPathHints", () => {
  it("merges /bids and /procurement onto typical county agenda seeds", () => {
    const fulton = ALL_JURISDICTIONS.find((j) => j.jurisdictionId === "county#GA#fulton");
    expect(fulton).toBeDefined();
    const hints = resolveCrawlPathHints(fulton!);
    expect(hints.slice(0, 3)).toEqual(["/bids", "/procurement", "/purchasing"]);
    expect(hints).toEqual(expect.arrayContaining(["/commissioners/agendas", "/meetings"]));
    expect(hints.length).toBeLessThanOrEqual(6);
  });

  it("does not add county bid boards to university crawls", () => {
    const uga = ALL_JURISDICTIONS.find((j) => j.jurisdictionId === "university#GA#uga");
    expect(uga).toBeDefined();
    const hints = resolveCrawlPathHints(uga!);
    expect(hints).not.toContain("/bids");
    expect(hints).not.toContain("/procurement");
  });

  it("honors explicit procurementPathHints", () => {
    const hints = resolveCrawlPathHints({
      type: "county",
      agendaPathHints: ["/meetings"],
      procurementPathHints: ["/departments/purchasing/open-bids"],
    });
    expect(hints[0]).toBe("/departments/purchasing/open-bids");
    expect(hints).toContain("/meetings");
    expect(hints).not.toContain("/bids");
  });
});

describe("Macon-Bibb jurisdiction seed", () => {
  it("registers Macon-Bibb with bids-first crawl hints", () => {
    const bibb = ALL_JURISDICTIONS.find((j) => j.jurisdictionId === "county#GA#bibb");
    expect(bibb?.name).toBe("Macon-Bibb County");
    expect(bibb?.agendaBaseUrl).toBe("https://www.maconbibb.us");
    expect(bibb?.agendaPathHints[0]).toBe("/bids");
    expect(bibb?.agendaPathHints.some((h) => h.includes("esinet"))).toBe(true);
    expect(bibb?.contactUrls?.some((u) => u.includes("bids"))).toBe(true);
    const hints = resolveCrawlPathHints(bibb!);
    expect(hints).toContain("/bids");
    expect(hints.some((h) => h.includes("esinet"))).toBe(true);
  });
});
