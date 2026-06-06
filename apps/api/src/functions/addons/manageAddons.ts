import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import type { AgencyTenant } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { syncAgencyAddonClaims } from "../../lib/cognito.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const agencies = new AgencyRepository();
const audits = new AuditRepository();

const putAddonsBodySchema = z
  .object({
    addons: z.array(z.string().trim().min(1).max(120)).max(200),
  })
  .strict();

function normalizeAddons(addons: string[]): string[] {
  return Array.from(
    new Set(
      addons
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort();
}

function isRcAdminRole(role: string): boolean {
  return role === "rcadmin" || role === "rcsuperadmin";
}

function withAddonFields(row: AgencyTenant, addons: string[]): AgencyTenant {
  return {
    ...row,
    addons,
    updatedAt: new Date().toISOString(),
  } as AgencyTenant;
}

async function writeAddonMutationAudit(input: {
  agencyId: string;
  actorId: string;
  actorRole: string;
  mutation: "replace" | "enable" | "disable";
  addonKey?: string;
  before: string[];
  after: string[];
}) {
  await audits.create({
    eventId: makeId("audit"),
    agencyId: input.agencyId,
    actorId: input.actorId,
    type: "tenant.addons.updated",
    details: {
      mutation: input.mutation,
      addonKey: input.addonKey,
      actorRole: input.actorRole,
      before: input.before,
      after: input.after,
    },
    createdAt: new Date().toISOString(),
    resourceType: "agency",
    resourceId: input.agencyId,
  });
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!isRcAdminRole(user.role)) return forbidden();

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return notFound("Missing agencyId");

    const row = await agencies.get(agencyId);
    if (!row) return notFound("Tenant not found");

    const method = event.requestContext.http?.method ?? "";
    const addonKeyParam = event.pathParameters?.addonKey?.trim();
    const before = normalizeAddons(((row as AgencyTenant & { addons?: string[] }).addons ?? []) as string[]);

    if (method === "GET") {
      return ok({
        agencyId,
        addons: before,
      });
    }

    if (method === "PUT") {
      const parsed = putAddonsBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const nextAddons = normalizeAddons(parsed.data.addons);
      const next = withAddonFields(row, nextAddons);
      await agencies.put(next);
      await writeAddonMutationAudit({
        agencyId,
        actorId: user.userId,
        actorRole: user.role,
        mutation: "replace",
        before,
        after: nextAddons,
      });
      const syncedUsers = await syncAgencyAddonClaims(agencyId, nextAddons);
      return ok({ agencyId, addons: nextAddons, syncedUsers });
    }

    if (method === "POST") {
      if (!addonKeyParam) return notFound("Missing addonKey");
      const nextAddons = normalizeAddons([...before, addonKeyParam]);
      const next = withAddonFields(row, nextAddons);
      await agencies.put(next);
      await writeAddonMutationAudit({
        agencyId,
        actorId: user.userId,
        actorRole: user.role,
        mutation: "enable",
        addonKey: addonKeyParam,
        before,
        after: nextAddons,
      });
      const syncedUsers = await syncAgencyAddonClaims(agencyId, nextAddons);
      return ok({ agencyId, addons: nextAddons, syncedUsers });
    }

    if (method === "DELETE") {
      if (!addonKeyParam) return notFound("Missing addonKey");
      const nextAddons = before.filter((key) => key !== addonKeyParam.toLowerCase());
      const next = withAddonFields(row, nextAddons);
      await agencies.put(next);
      await writeAddonMutationAudit({
        agencyId,
        actorId: user.userId,
        actorRole: user.role,
        mutation: "disable",
        addonKey: addonKeyParam,
        before,
        after: nextAddons,
      });
      const syncedUsers = await syncAgencyAddonClaims(agencyId, nextAddons);
      return ok({ agencyId, addons: nextAddons, syncedUsers });
    }

    return notFound();
  } catch (error) {
    console.error("manageAddons.handler", error);
    return serverError();
  }
};

