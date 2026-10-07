import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  hashAddress,
  type ResponderCheckin,
  type VenueAsset,
  type VenueCamera,
  type VenueEmergencyPlan,
  type VenueFacility,
  type VenueFloorPlan,
  type VenueIncidentOverlay,
  type VenueIntelligence,
} from "./venue-types.js";

// Incident type → relevant plan types (ordered by priority)
const INCIDENT_TYPE_PLAN_MAP: Record<string, string[]> = {
  ACTIVE_THREAT: ["ACTIVE_THREAT", "LOCKDOWN"],
  FIRE: ["FIRE", "EVACUATION"],
  MEDICAL: ["MEDICAL", "MASS_CASUALTY"],
  HAZMAT: ["HAZMAT", "EVACUATION"],
  EVACUATION: ["EVACUATION"],
  BOMB_THREAT: ["BOMB_THREAT", "EVACUATION"],
  SEVERE_WEATHER: ["SEVERE_WEATHER"],
  CROWD_EMERGENCY: ["CROWD_EMERGENCY", "EVACUATION"],
};

export class VenueIntelligenceService {
  private readonly ddb: DynamoDBDocumentClient;

  constructor(ddb?: DynamoDBDocumentClient) {
    this.ddb = ddb ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  /**
   * Primary entry point. Called when an incident is created or when a dispatcher
   * opens the incident view. Returns null if no registered facility at the address.
   * Dispatcher review and control are always preserved — system surfaces,
   * dispatcher acts.
   */
  async getIntelligence(opts: {
    address: string;
    agencyId: string;
    incidentId?: string;
    incidentType?: string;
    floor?: number;
  }): Promise<VenueIntelligence | null> {
    const addressHash = hashAddress(opts.address);

    // 1. Find facility by address hash
    const facility = await this.findByAddressHash(addressHash, opts.agencyId);
    if (!facility) return null;

    const floor = opts.floor ?? 1;

    // 2. Fetch supporting data in parallel
    const [assets, plans, floorPlan, overlays, checkins] = await Promise.all([
      this.getAllAssets(facility.facilityId),
      this.getRelevantPlans(facility.facilityId, opts.incidentType),
      this.getFloorPlan(facility.facilityId, floor),
      opts.incidentId ? this.getOverlays(opts.incidentId) : Promise.resolve<VenueIncidentOverlay[]>([]),
      opts.incidentId ? this.getCheckins(opts.incidentId) : Promise.resolve<ResponderCheckin[]>([]),
    ]);

    // 3. Only surface cameras if facility opted in AND incident context is present
    const cameras =
      facility.cameraRoutingEnabled && opts.incidentId
        ? await this.getCameras(facility.facilityId)
        : [];

    return {
      facility,
      floorPlan: floorPlan ?? undefined,
      assets,
      nearestAEDs: assets.filter((a) => a.assetType === "AED").slice(0, 3),
      nearestExits: assets.filter((a) => a.assetType === "EMERGENCY_EXIT").slice(0, 5),
      nearestFirePanel: assets.find((a) => a.assetType === "FIRE_PANEL") ?? null,
      stagingAreas: assets.filter((a) => a.assetType === "STAGING_AREA"),
      musterPoints: assets.filter((a) => a.assetType === "MUSTER_POINT"),
      relevantPlans: plans,
      cameras,
      activeOverlays: overlays,
      responderCheckins: checkins,
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async findByAddressHash(
    addressHash: string,
    agencyId: string,
  ): Promise<VenueFacility | null> {
    const result = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.VENUE_FACILITIES_TABLE!,
        IndexName: "addressHash-sk-index",
        KeyConditionExpression: "addressHash = :ah AND sk = :sk",
        FilterExpression: "agencyId = :aid AND #st = :active",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":ah": addressHash,
          ":sk": "PROFILE",
          ":aid": agencyId,
          ":active": "ACTIVE",
        },
        Limit: 1,
      }),
    );
    return (result.Items?.[0] as VenueFacility) ?? null;
  }

  private async getAllAssets(facilityId: string): Promise<VenueAsset[]> {
    const result = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.VENUE_ASSETS_TABLE!,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `FACILITY#${facilityId}`,
          ":prefix": "ASSET#",
        },
      }),
    );
    return (result.Items ?? []) as VenueAsset[];
  }

  private async getFloorPlan(
    facilityId: string,
    floor: number,
  ): Promise<VenueFloorPlan | null> {
    const result = await this.ddb.send(
      new GetCommand({
        TableName: process.env.VENUE_FACILITIES_TABLE!,
        Key: {
          pk: `FACILITY#${facilityId}`,
          sk: `FLOOR#${floor}`,
        },
      }),
    );
    return (result.Item as VenueFloorPlan) ?? null;
  }

  private async getRelevantPlans(
    facilityId: string,
    incidentType?: string,
  ): Promise<VenueEmergencyPlan[]> {
    const result = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.VENUE_FACILITIES_TABLE!,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `FACILITY#${facilityId}`,
          ":prefix": "PLAN#",
        },
      }),
    );

    const plans = (result.Items ?? []) as VenueEmergencyPlan[];
    if (!incidentType) return plans;

    const relevantTypes = INCIDENT_TYPE_PLAN_MAP[incidentType.toUpperCase()] ?? [];

    const relevant = plans.filter((p) => relevantTypes.includes(p.planType));
    const others = plans.filter((p) => !relevantTypes.includes(p.planType));
    return [...relevant, ...others];
  }

  private async getOverlays(incidentId: string): Promise<VenueIncidentOverlay[]> {
    const result = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.VENUE_OVERLAYS_TABLE!,
        IndexName: "incidentId-sk-index",
        KeyConditionExpression: "incidentId = :iid",
        ExpressionAttributeValues: { ":iid": incidentId },
      }),
    );
    return (result.Items ?? []) as VenueIncidentOverlay[];
  }

  private async getCheckins(incidentId: string): Promise<ResponderCheckin[]> {
    const result = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.VENUE_OVERLAYS_TABLE!,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `INCIDENT#${incidentId}`,
          ":prefix": "CHECKIN#",
        },
      }),
    );
    return (result.Items ?? []) as ResponderCheckin[];
  }

  private async getCameras(facilityId: string): Promise<VenueCamera[]> {
    const result = await this.ddb.send(
      new QueryCommand({
        TableName: process.env.VENUE_FACILITIES_TABLE!,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        FilterExpression: "#st <> :disabled",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":pk": `FACILITY#${facilityId}`,
          ":prefix": "CAMERA#",
          ":disabled": "DISABLED",
        },
      }),
    );
    return (result.Items ?? []) as VenueCamera[];
  }
}
