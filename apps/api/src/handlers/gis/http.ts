/**
 * GIS Intelligence HTTP router — /api/gis/*
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  canManageGisDatasets,
  canViewGisLayers,
  gisApproveBodySchema,
  gisDiscoverQuerySchema,
  gisImportBodySchema,
  gisSpatialContextBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { makeId } from "../../lib/ids.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { SsrfBlockedError } from "../../gis/safe-fetch.js";
import {
  approveGisDataset,
  discoverGis,
  getGisDatasetGeoJson,
  importGisDataset,
  listGisDatasets,
  listGisLayers,
  spatialContext,
} from "../../gis/service.js";

const auditRepo = new AuditRepository();

function methodOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method?.toUpperCase() ?? "GET";
}

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body) as unknown;
  } catch {
    return null;
  }
}

async function auditSafe(
  type: string,
  agencyId: string,
  actorId: string,
  details: Record<string, unknown>,
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
      resourceType: "gis_dataset",
      resourceId,
    });
  } catch (e) {
    console.warn("[gis] audit failed", e instanceof Error ? e.message : String(e));
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!env.enableGis) {
    return forbidden("GIS intelligence is disabled");
  }

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

  const m = methodOf(event);
  const path = pathOf(event);

  try {
    // GET /api/gis/discover
    if (m === "GET" && /\/api\/gis\/discover\/?$/.test(path)) {
      if (!canManageGisDatasets(user.role)) return forbidden();
      const parsed = gisDiscoverQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const result = await discoverGis(user, parsed.data);
      if (user.agencyId) {
        await auditSafe(
          AUDIT_EVENT_TYPES.GIS_DISCOVER_QUERIED,
          user.agencyId,
          user.userId,
          { candidateCount: result.candidates.length, serviceUrl: parsed.data.serviceUrl ?? null },
          "discover",
        );
      }
      return ok(result);
    }

    // GET /api/gis/datasets
    if (m === "GET" && /\/api\/gis\/datasets\/?$/.test(path)) {
      if (!canManageGisDatasets(user.role)) return forbidden();
      const items = await listGisDatasets(user);
      return ok({ items });
    }

    // POST /api/gis/datasets/import
    if (m === "POST" && /\/api\/gis\/datasets\/import\/?$/.test(path)) {
      if (!canManageGisDatasets(user.role)) return forbidden();
      const body = parseBody(event);
      if (body === null) return badRequest("Invalid JSON");
      const parsed = gisImportBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const record = await importGisDataset(user, parsed.data);
      await auditSafe(
        AUDIT_EVENT_TYPES.GIS_DATASET_IMPORTED,
        record.agencyId,
        user.userId,
        { datasetId: record.datasetId, featureCount: record.featureCount, sourceUrl: record.sourceUrl },
        record.datasetId,
      );
      return ok({ dataset: record }, 201);
    }

    // POST /api/gis/datasets/{id}/approve
    const approveMatch = path.match(/\/api\/gis\/datasets\/([^/]+)\/approve\/?$/);
    if (m === "POST" && approveMatch) {
      if (!canManageGisDatasets(user.role)) return forbidden();
      const body = parseBody(event);
      if (body === null) return badRequest("Invalid JSON");
      const parsed = gisApproveBodySchema.safeParse(body ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const record = await approveGisDataset(user, decodeURIComponent(approveMatch[1]!), parsed.data.approved);
      await auditSafe(
        parsed.data.approved
          ? AUDIT_EVENT_TYPES.GIS_DATASET_APPROVED
          : AUDIT_EVENT_TYPES.GIS_DATASET_REJECTED,
        record.agencyId,
        user.userId,
        { datasetId: record.datasetId },
        record.datasetId,
      );
      return ok({ dataset: record });
    }

    // GET /api/gis/datasets/{id}/geojson — admin preview (any status)
    const geoMatch = path.match(/\/api\/gis\/datasets\/([^/]+)\/geojson\/?$/);
    if (m === "GET" && geoMatch) {
      if (!canManageGisDatasets(user.role) && !canViewGisLayers(user.role)) return forbidden();
      const fc = await getGisDatasetGeoJson(user, decodeURIComponent(geoMatch[1]!));
      if (!fc) return notFound("Dataset not found");
      return ok(fc);
    }

    // GET /api/gis/layers
    if (m === "GET" && /\/api\/gis\/layers\/?$/.test(path)) {
      if (!canViewGisLayers(user.role)) return forbidden();
      const layers = await listGisLayers(user);
      return ok({ layers });
    }

    // POST /api/gis/spatial-context
    if (m === "POST" && /\/api\/gis\/spatial-context\/?$/.test(path)) {
      if (!canViewGisLayers(user.role)) return forbidden();
      const body = parseBody(event);
      if (body === null) return badRequest("Invalid JSON");
      const parsed = gisSpatialContextBodySchema.safeParse(body);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const result = await spatialContext(user, parsed.data);
      if (user.agencyId) {
        await auditSafe(
          AUDIT_EVENT_TYPES.GIS_SPATIAL_CONTEXT,
          user.agencyId,
          user.userId,
          { hitCount: result.hits.length, lat: result.lat, lng: result.lng },
          "spatial-context",
        );
      }
      return ok(result);
    }

    return notFound("Unknown GIS route");
  } catch (e) {
    if (e instanceof SsrfBlockedError) {
      return badRequest("Blocked unsafe URL");
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NOT_FOUND") return notFound();
    if (msg === "AGENCY_REQUIRED") return forbidden("agency required");
    console.error("[gis/http]", e);
    return serverError();
  }
};
