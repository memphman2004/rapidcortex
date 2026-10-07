import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES, AuthorizationService } from "rapid-cortex-security";
import {
  competitorOutlineBodySchema,
  keywordIntelBodySchema,
  patchSeoIssueBodySchema,
  postSeoScanBodySchema,
  schemaGenerateBodySchema,
  seoSuggestionsBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SeoIntelligenceRepository } from "../../repositories/seoIntelligenceRepository.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { generateJsonLd } from "../../services/seo/schemaJsonLd.js";
import { getCompetitorOutline } from "../../services/seo/competitorOutlines.js";
import { analyzeKeywords, buildKeywordSuggestions } from "../../services/seo/keywordIntel.js";
import { analyzeHtml } from "../../services/seo/pageAnalysis.js";
import { fetchHtmlWithLimits } from "../../services/seo/fetchPage.js";
import { runPageSeoScan } from "../../services/seo/seoScanRunner.js";
import { generateSeoSuggestionsAi } from "../../services/seo/seoSuggestions.js";
import { assertSafeFetchUrl, SsrfBlockedError } from "../../services/seo/ssrfGuard.js";
import { checkSitemapAndRobots } from "../../services/seo/sitemapRobots.js";
import { z } from "zod";

const authz = new AuthorizationService();
const repo = new SeoIntelligenceRepository();
const auditRepo = new AuditRepository();

const sitemapQuerySchema = z.object({
  origin: z.string().url(),
});

function cors204() {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "authorization,content-type",
    },
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    if (method === "OPTIONS") return cors204();

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!authz.canAccessAdminRoutes(user)) return forbidden();

    if (process.env.SEO_TOOL_ENABLED === "false") {
      return serviceUnavailable("Cortex SEO Intelligence is disabled in this environment.");
    }
    if (!env.seoIntelligenceTable.trim()) {
      return serviceUnavailable("Cortex SEO Intelligence storage is not configured.");
    }

    const rawPath = event.rawPath ?? "";
    const base = "/api/admin/seo";
    const subpath = rawPath.startsWith(base) ? rawPath.slice(base.length) || "/" : "/";

    if (subpath === "/settings" && method === "GET") {
      return ok({
        seoToolEnabled: process.env.SEO_TOOL_ENABLED !== "false",
        seoAutoScanEnabled: process.env.SEO_AUTO_SCAN_ENABLED === "true",
        seoAiSuggestionsEnabled: process.env.SEO_AI_SUGGESTIONS_ENABLED !== "false",
      });
    }

    if (subpath === "/overview" && method === "GET") {
      const scans = await repo.listScans(user.agencyId, 200);
      const issues = await repo.listIssues(user.agencyId, 500);
      const openIssues = issues.filter((i) => i.status === "OPEN").length;
      const lastScanAt = scans[0]?.updatedAt ?? null;
      return ok({
        scanCount: scans.length,
        openIssues,
        lastScanAt,
        recentScans: scans.slice(0, 10),
      });
    }

    if (subpath === "/scans" && method === "POST") {
      const parsed = postSeoScanBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (process.env.SEO_AUTO_SCAN_ENABLED !== "true" && parsed.data.schedule && parsed.data.schedule !== "manual") {
        return badRequest("Automated schedules are disabled (SEO_AUTO_SCAN_ENABLED=false). Use manual scans.");
      }
      console.log(
        JSON.stringify({
          type: "seo.scan.requested",
          agencyId: user.agencyId,
          actorId: user.userId,
          url: parsed.data.url,
          at: new Date().toISOString(),
        }),
      );
      const record = await runPageSeoScan({
        agencyId: user.agencyId,
        url: parsed.data.url,
        keywords: parsed.data.keywords,
        schedule: parsed.data.schedule,
        repo,
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SEO_INTELLIGENCE_SCAN_RUN,
        details: { scanId: record.id, url: record.url, score: record.score, status: record.scanStatus },
        createdAt: new Date().toISOString(),
        resourceType: "unknown",
        resourceId: record.id,
      });
      return ok(record, 201);
    }

    if (subpath === "/scans" && method === "GET") {
      const items = await repo.listScans(user.agencyId, 50);
      return ok({ items });
    }

    const scanGet = subpath.match(/^\/scans\/([^/]+)$/);
    if (scanGet && method === "GET") {
      const scanId = scanGet[1];
      const row = await repo.getScan(user.agencyId, scanId);
      if (!row) return notFound();
      return ok(row);
    }

    if (subpath === "/issues" && method === "GET") {
      const items = await repo.listIssues(user.agencyId, 100);
      return ok({ items });
    }

    const issuePatch = subpath.match(/^\/issues\/([^/]+)$/);
    if (issuePatch && method === "PATCH") {
      const issueId = issuePatch[1];
      const parsed = patchSeoIssueBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const updated = await repo.updateIssueStatus(user.agencyId, issueId, parsed.data.status);
      if (!updated) return notFound();
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SEO_INTELLIGENCE_ISSUE_UPDATED,
        details: { issueId, status: parsed.data.status },
        createdAt: new Date().toISOString(),
        resourceType: "unknown",
        resourceId: issueId,
      });
      return ok(updated);
    }

    if (subpath === "/keywords/analyze" && method === "POST") {
      const parsed = keywordIntelBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const safe = await assertSafeFetchUrl(parsed.data.url);
      const fetched = await fetchHtmlWithLimits(safe.href);
      const analysis = analyzeHtml(fetched.html, fetched.finalUrl);
      const placements = analyzeKeywords(fetched.finalUrl, analysis, parsed.data.keywords);
      const suggestions = buildKeywordSuggestions(fetched.finalUrl, analysis, placements);
      return ok({ placements, suggestions });
    }

    if (subpath === "/suggestions" && method === "POST") {
      const parsed = seoSuggestionsBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const result = await generateSeoSuggestionsAi(parsed.data);
      return ok({
        source: result.source === "model" ? "seo_intelligence_suggestions" : "rules",
        suggestions: result.payload,
      });
    }

    if (subpath === "/schema/generate" && method === "POST") {
      const parsed = schemaGenerateBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const jsonLd = generateJsonLd(parsed.data.type, parsed.data.payload as Record<string, unknown>);
      return ok({ jsonLd });
    }

    if (subpath === "/sitemap-check" && method === "GET") {
      const q = event.queryStringParameters ?? {};
      const parsed = sitemapQuerySchema.safeParse({ origin: q.origin });
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const report = await checkSitemapAndRobots(parsed.data.origin);
      return ok(report);
    }

    if (subpath === "/competitor-outline" && method === "POST") {
      const parsed = competitorOutlineBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const outline = getCompetitorOutline(parsed.data.topicId);
      return ok(outline);
    }

    return notFound();
  } catch (e) {
    if (e instanceof SsrfBlockedError) return badRequest("URL is not allowed (blocked as SSRF risk).");
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "SSRF_BLOCKED" || msg.startsWith("SSRF_BLOCKED")) return badRequest("URL is not allowed (blocked as SSRF risk).");
    if (msg === "PAGE_TOO_LARGE") return badRequest("Page exceeded maximum download size.");
    if (msg === "SEO_INTELLIGENCE_UNAVAILABLE") return serviceUnavailable("SEO storage is not configured.");
    console.error(JSON.stringify({ type: "seo.handler.error", error: msg }));
    return serverError();
  }
};
