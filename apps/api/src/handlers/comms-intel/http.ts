/**
 * Communications Intelligence HTTP router.
 * Routes: /api/comms-intel/*, /api/context-cards/*, /api/command/*, /api/vault/*
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  isRcInternalOperator,
  putSafetyFlagBodySchema,
  vaultSearchQuerySchema,
  vaultUploadUrlBodySchema,
  type AuditResourceType,
} from "rapid-cortex-shared";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { env } from "../../lib/env.js";
import { requireAddon } from "../../middleware/requireAddon.js";
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
import { AuditRepository } from "../../repositories/auditRepository.js";
import * as contextCards from "../../comms-intel/context-card-service.js";
import * as command from "../../comms-intel/command-service.js";
import * as vault from "../../comms-intel/vault-service.js";
import {
  isCommandExporter,
  isCommandViewer,
  isContextCardAdmin,
  isContextCardViewer,
  isVaultAdmin,
  isVaultSearcher,
} from "../../comms-intel/rbac.js";

const auditRepo = new AuditRepository();
const requireContextCardsAddon = requireAddon("comms_intel.context_cards");
const requireCommandIntelAddon = requireAddon("comms_intel.command_intelligence");
const requireNexiqVaultAddon = requireAddon("comms_intel.nexiq_vault");

async function gateAddon(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  user: NonNullable<Awaited<ReturnType<typeof getUserContext>>>,
  mw: ReturnType<typeof requireAddon>,
  flagOn: boolean,
  label: string,
) {
  if (!flagOn) {
    return withCorrelationHeaders(event, serviceUnavailable(`${label} is not enabled for this deployment`));
  }
  if (isRcInternalOperator(user.role)) return null;
  const deny = await mw(event, user);
  return deny ? withCorrelationHeaders(event, deny) : null;
}

async function vaultEnrichmentAllowed(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  user: NonNullable<Awaited<ReturnType<typeof getUserContext>>>,
): Promise<boolean> {
  if (!env.enableNexiqVault) return false;
  if (isRcInternalOperator(user.role)) return true;
  const deny = await requireNexiqVaultAddon(event, user);
  return deny == null;
}

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  const raw = event.rawPath || event.requestContext?.http?.path || "";
  return raw.split("?")[0] || "";
}

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext?.http?.method || event.requestContext?.http?.method || "GET").toUpperCase();
}

async function auditSafe(
  type: string,
  agencyId: string,
  actorId: string,
  details: Record<string, unknown>,
  resourceType: AuditResourceType,
  resourceId: string,
) {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId,
      type: type as never,
      details,
      createdAt: new Date().toISOString(),
      resourceType,
      resourceId,
    });
  } catch (e) {
    console.warn("comms-intel audit failed", e instanceof Error ? e.message : String(e));
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    if (!user.agencyId && user.role !== "rcsuperadmin") {
      return withCorrelationHeaders(event, forbidden("agency required"));
    }

    const method = methodOf(event);
    const path = pathOf(event);
    const qs = event.queryStringParameters ?? {};

    // --- Context cards ---
    const incidentCtx =
      path.match(/^\/api\/comms-intel\/incidents\/([^/]+)\/context-card$/) ||
      path.match(/^\/api\/incidents\/([^/]+)\/context-card$/);
    if (method === "GET" && incidentCtx) {
      if (!isContextCardViewer(user)) return withCorrelationHeaders(event, forbidden());
      const ctxGate = await gateAddon(
        event,
        user,
        requireContextCardsAddon,
        env.enableContextCards,
        "Context Cards",
      );
      if (ctxGate) return ctxGate;
      const allowVault = await vaultEnrichmentAllowed(event, user);
      const card = await contextCards.resolveContextCard({
        user,
        incidentId: decodeURIComponent(incidentCtx[1]),
        allowVault,
      });
      if (!card) return withCorrelationHeaders(event, notFound("Incident not found"));
      await auditSafe(
        AUDIT_EVENT_TYPES.CONTEXT_CARD_VIEWED,
        card.agencyId,
        user.userId,
        { incidentId: card.incidentId, cardType: "location" },
        "incident",
        card.incidentId,
      );
      return withCorrelationHeaders(event, ok(card));
    }

    if (method === "GET" && (path === "/api/context-cards/address" || path === "/api/comms-intel/context-cards/address")) {
      if (!isContextCardViewer(user)) return withCorrelationHeaders(event, forbidden());
      const ctxGate = await gateAddon(
        event,
        user,
        requireContextCardsAddon,
        env.enableContextCards,
        "Context Cards",
      );
      if (ctxGate) return ctxGate;
      const addr = qs.addr?.trim();
      if (!addr) return withCorrelationHeaders(event, badRequest("addr required"));
      const allowVault = await vaultEnrichmentAllowed(event, user);
      const card = await contextCards.resolveContextCardByAddress({ user, address: addr, allowVault });
      await auditSafe(
        AUDIT_EVENT_TYPES.CONTEXT_CARD_VIEWED,
        card.agencyId,
        user.userId,
        { cardType: "address_lookup" },
        "context_card",
        card.location.normalizedAddress,
      );
      return withCorrelationHeaders(event, ok(card));
    }

    if (method === "PUT" && (path === "/api/context-cards/safety-flag" || path === "/api/comms-intel/context-cards/safety-flag")) {
      if (!isContextCardAdmin(user)) return withCorrelationHeaders(event, forbidden());
      const ctxGate = await gateAddon(
        event,
        user,
        requireContextCardsAddon,
        env.enableContextCards,
        "Context Cards",
      );
      if (ctxGate) return ctxGate;
      let body: unknown = {};
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const parsed = putSafetyFlagBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const out = await contextCards.putSafetyFlag(user, parsed.data);
      await auditSafe(
        parsed.data.officerSafetyFlag
          ? AUDIT_EVENT_TYPES.SAFETY_FLAG_SET
          : AUDIT_EVENT_TYPES.SAFETY_FLAG_CLEARED,
        user.agencyId!,
        user.userId,
        { address: out.normalizedAddress, note: parsed.data.officerSafetyNote ?? null },
        "context_card",
        out.normalizedAddress,
      );
      return withCorrelationHeaders(event, ok(out));
    }

    // --- Command Intelligence ---
    if (path.startsWith("/api/command/") || path.startsWith("/api/comms-intel/command/")) {
      const cmdGate = await gateAddon(
        event,
        user,
        requireCommandIntelAddon,
        env.enableCommandIntelligence,
        "Command Intelligence",
      );
      if (cmdGate) return cmdGate;
      const sub = path.replace(/^\/api\/(comms-intel\/)?command\//, "");

      if (method === "GET" && (sub === "summary" || sub.startsWith("summary?"))) {
        if (!isCommandViewer(user)) return withCorrelationHeaders(event, forbidden());
        const summary = await command.getCommandSummary(user, {
          date: qs.date,
          range: qs.range,
        });
        await auditSafe(
          AUDIT_EVENT_TYPES.COMMAND_DASHBOARD_VIEWED,
          user.agencyId!,
          user.userId,
          { dateRange: qs.range ?? "today" },
          "command",
          user.agencyId!,
        );
        return withCorrelationHeaders(event, ok(summary));
      }

      if (method === "GET" && sub.startsWith("locations/repeat")) {
        if (!isCommandViewer(user)) return withCorrelationHeaders(event, forbidden());
        const summary = await command.getCommandSummary(user, { range: "30d" });
        return withCorrelationHeaders(event, ok({ locations: summary.repeatLocations ?? [] }));
      }

      if (method === "GET" && sub.startsWith("translation/breakdown")) {
        if (!isCommandViewer(user)) return withCorrelationHeaders(event, forbidden());
        const summary = await command.getCommandSummary(user, { date: qs.date, range: qs.range });
        return withCorrelationHeaders(event, ok({ languages: summary.translationUsageByLanguage }));
      }

      if (method === "GET" && sub.startsWith("drill")) {
        if (!isCommandViewer(user)) return withCorrelationHeaders(event, forbidden());
        const summary = await command.getCommandSummary(user, { range: qs.range ?? "today" });
        return withCorrelationHeaders(
          event,
          ok({
            level: qs.level ?? "agency",
            id: qs.id ?? user.agencyId,
            summary,
          }),
        );
      }

      if (method === "GET" && sub.startsWith("export")) {
        if (!isCommandExporter(user)) return withCorrelationHeaders(event, forbidden());
        const csv = await command.exportCommandCsv(user, { date: qs.date, range: qs.range });
        await auditSafe(
          AUDIT_EVENT_TYPES.COMMAND_EXPORT,
          user.agencyId!,
          user.userId,
          { format: "csv", dateRange: qs.range ?? "today" },
          "command",
          user.agencyId!,
        );
        return withCorrelationHeaders(event, {
          statusCode: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="command-intelligence.csv"',
          },
          body: csv,
        });
      }
    }

    // --- Vault ---
    if (path.startsWith("/api/vault/") || path.startsWith("/api/comms-intel/vault/")) {
      const vaultGate = await gateAddon(
        event,
        user,
        requireNexiqVaultAddon,
        env.enableNexiqVault,
        "NexiQ Vault",
      );
      if (vaultGate) return vaultGate;
      const sub = path.replace(/^\/api\/(comms-intel\/)?vault\//, "");

      if (method === "POST" && sub === "upload-url") {
        if (!isVaultAdmin(user)) return withCorrelationHeaders(event, forbidden());
        let body: unknown = {};
        try {
          body = JSON.parse(event.body ?? "{}");
        } catch {
          return withCorrelationHeaders(event, badRequest("Invalid JSON"));
        }
        const parsed = vaultUploadUrlBodySchema.safeParse(body);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const out = await vault.createVaultUploadUrl(user, parsed.data);
        await auditSafe(
          AUDIT_EVENT_TYPES.VAULT_INGESTION_STARTED,
          user.agencyId!,
          user.userId,
          { jobId: out.jobId, fileName: parsed.data.fileName },
          "vault_job",
          out.jobId,
        );
        return withCorrelationHeaders(event, ok(out));
      }

      if (method === "GET" && sub === "jobs") {
        if (!isVaultAdmin(user)) return withCorrelationHeaders(event, forbidden());
        return withCorrelationHeaders(event, ok({ jobs: await vault.listVaultJobs(user) }));
      }

      const jobMatch = sub.match(/^jobs\/([^/]+)$/);
      if (method === "GET" && jobMatch) {
        if (!isVaultAdmin(user)) return withCorrelationHeaders(event, forbidden());
        const job = await vault.getVaultJob(user, jobMatch[1]);
        if (!job) return withCorrelationHeaders(event, notFound("Job not found"));
        return withCorrelationHeaders(event, ok(job));
      }
      if (method === "DELETE" && jobMatch) {
        if (!isVaultAdmin(user)) return withCorrelationHeaders(event, forbidden());
        await vault.deleteVaultJob(user, jobMatch[1]);
        await auditSafe(
          AUDIT_EVENT_TYPES.VAULT_RECORD_DELETED,
          user.agencyId!,
          user.userId,
          { jobId: jobMatch[1] },
          "vault_job",
          jobMatch[1],
        );
        return withCorrelationHeaders(event, ok({ deleted: true }));
      }

      if (method === "GET" && sub.startsWith("search")) {
        if (!isVaultSearcher(user)) return withCorrelationHeaders(event, forbidden());
        const parsed = vaultSearchQuerySchema.safeParse(qs);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const result = await vault.searchVault(user, parsed.data);
        await auditSafe(
          AUDIT_EVENT_TYPES.VAULT_SEARCH,
          user.agencyId!,
          user.userId,
          { resultCount: result.items.length, addr: parsed.data.addr },
          "vault",
          user.agencyId!,
        );
        return withCorrelationHeaders(event, ok(result));
      }

      const locMatch = sub.match(/^location\/(.+)$/);
      if (method === "GET" && locMatch) {
        if (!isVaultSearcher(user)) return withCorrelationHeaders(event, forbidden());
        const summary = await vault.getVaultLocationSummary(user, decodeURIComponent(locMatch[1]));
        return withCorrelationHeaders(event, ok({ location: summary }));
      }
    }

    return withCorrelationHeaders(event, notFound("Route not found"));
  } catch (e) {
    console.error("comms-intel http error", e instanceof Error ? e.message : String(e));
    return withCorrelationHeaders(event, serverError());
  }
};
