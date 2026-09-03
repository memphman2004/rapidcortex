/**
 * Seeds Hoover Valley Transit (test-transit-hvt) fleet/config tables.
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-transit-test-agency.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { defaultAgencyNetworkPolicy } from "rapid-cortex-shared";

const REGION = process.env.AWS_REGION?.trim() || "us-east-1";
const STAGE = process.env.DEPLOYMENT_STAGE?.trim() || "dev";
const AGENCY_ID = process.env.TRANSIT_TEST_AGENCY_ID?.trim() || "test-transit-hvt";
const AGENCIES_TABLE = process.env.AGENCIES_TABLE?.trim() || `rapid-cortex-agencies-${STAGE}`;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TABLES = {
  vehicles: process.env.TRANSIT_VEHICLES_TABLE?.trim() || `rapid-cortex-transit-vehicles-${STAGE}`,
  routes: process.env.TRANSIT_ROUTES_TABLE?.trim() || `rapid-cortex-transit-routes-${STAGE}`,
  stations: process.env.TRANSIT_STATIONS_TABLE?.trim() || `rapid-cortex-transit-stations-${STAGE}`,
  operators: process.env.TRANSIT_OPERATORS_TABLE?.trim() || `rapid-cortex-transit-operators-${STAGE}`,
  incidents: process.env.TRANSIT_INCIDENTS_TABLE?.trim() || `rapid-cortex-transit-incidents-${STAGE}`,
  reports: process.env.TRANSIT_REPORTS_TABLE?.trim() || `rapid-cortex-transit-reports-${STAGE}`,
  config: process.env.TRANSIT_CONFIG_TABLE?.trim() || `rapid-cortex-transit-config-${STAGE}`,
};

async function put(table: string, item: Record<string, unknown>): Promise<void> {
  await ddb.send(new PutCommand({ TableName: table, Item: item }));
}

async function main(): Promise<void> {
  const now = new Date().toISOString();
  await put(AGENCIES_TABLE, {
    agencyId: AGENCY_ID,
    name: "Hoover Valley Transit",
    type: "transit",
    vertical: "transit",
    status: "active",
    state: "AL",
    city: "Hoover",
    centerName: "Hoover Valley Transit",
    region: "Southeast",
    primaryContactName: "Transit Admin",
    primaryContactEmail: "transit-admin@rapidcortex.us",
    deploymentMode: "side_by_side",
    protocolPackId: "default",
    retentionPolicyId: "cjis-default-v1",
    integrationMode: "mock_adapters",
    createdAt: now,
    updatedAt: now,
    createdByUserId: "seed-transit",
    monetizationPlanId: "command",
    subscriptionStatus: "active",
    planId: "command",
    config: {
      agencyId: AGENCY_ID,
      protocolPackId: "default",
      aiProviderProfileId: "default",
      retentionPolicyId: "cjis-default-v1",
      integrationMode: "mock_adapters",
      transcriptRedactionEnabled: true,
      auditExportEnabled: false,
      environmentFlags: {},
      supervisorEscalationRules: {},
      createdAt: now,
      updatedAt: now,
    },
    networkPolicy: defaultAgencyNetworkPolicy("seed-transit"),
  });

  const routes = [
    { routeId: "r14", name: "Route 14", mode: "bus" as const },
    { routeId: "red", name: "Red Line", mode: "light_rail" as const },
    { routeId: "ferry-n", name: "Ferry North", mode: "ferry" as const },
  ];
  for (const route of routes) {
    const stationIds = Array.from({ length: 10 }, (_, i) => `${route.routeId}-st-${i + 1}`);
    await put(TABLES.routes, {
      agencyId: AGENCY_ID,
      ...route,
      stationIds,
      color: route.mode === "bus" ? "#3b82f6" : route.mode === "ferry" ? "#06b6d4" : "#ef4444",
      active: true,
      updatedAt: now,
    });
    for (let i = 0; i < 10; i += 1) {
      await put(TABLES.stations, {
        agencyId: AGENCY_ID,
        stationId: stationIds[i],
        name: `${route.name} Stop ${i + 1}`,
        routeIds: [route.routeId],
        lat: 33.405 + i * 0.008,
        lng: -86.81 + i * 0.006,
        adaAccessible: i % 2 === 0,
        updatedAt: now,
      });
    }
  }

  const vehicles = [
    ...Array.from({ length: 8 }, (_, i) => ({
      vehicleId: `bus-${i + 1}`,
      label: `Bus ${i + 1}`,
      mode: "bus" as const,
      routeId: "r14",
      status: i === 2 ? ("delayed" as const) : ("in_service" as const),
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      vehicleId: `train-${i + 1}`,
      label: `Red ${i + 1}`,
      mode: "light_rail" as const,
      routeId: "red",
      status: i === 0 ? ("incident" as const) : ("in_service" as const),
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      vehicleId: `ferry-${i + 1}`,
      label: `Ferry ${i + 1}`,
      mode: "ferry" as const,
      routeId: "ferry-n",
      status: "in_service" as const,
    })),
  ];
  for (const [idx, vehicle] of vehicles.entries()) {
    await put(TABLES.vehicles, {
      agencyId: AGENCY_ID,
      ...vehicle,
      operatorId: idx < 8 ? `op-${idx + 1}` : undefined,
      lastLat: 33.42 + idx * 0.004,
      lastLng: -86.8 + (idx % 5) * 0.005,
      heading: (idx * 24) % 360,
      speedKph: vehicle.status === "in_service" ? 32 : 8,
      gpsAt: now,
      cameraIds: idx % 4 === 0 ? [`CAM-${vehicle.vehicleId}`] : [],
      updatedAt: now,
    });
  }

  for (let i = 0; i < 8; i += 1) {
    const operator: Record<string, unknown> = {
      agencyId: AGENCY_ID,
      operatorId: `op-${i + 1}`,
      displayName: `Operator ${i + 1}`,
      vehicleId: `bus-${i + 1}`,
      onDuty: true,
      radioCallsign: `HV-${10 + i}`,
      updatedAt: now,
    };
    if (i === 0) {
      operator.userId =
        process.env.TRANSIT_OPERATOR_USER_ID?.trim() || "transit-operator@rapidcortex.us";
    }
    await put(TABLES.operators, operator);
  }

  const incidents = [
    {
      incidentId: "tinc-demo-rail",
      type: "mechanical",
      vehicleId: "train-1",
      routeId: "red",
      summary: "Red Line car reports door fault at Stop 3",
    },
    {
      incidentId: "tinc-demo-bus",
      type: "medical",
      vehicleId: "bus-3",
      routeId: "r14",
      summary: "Passenger medical assist requested on Route 14",
    },
    {
      incidentId: "tinc-demo-ferry",
      type: "accessibility",
      vehicleId: "ferry-1",
      routeId: "ferry-n",
      summary: "Lift delay boarding Ferry North",
    },
  ];
  for (const incident of incidents) {
    await put(TABLES.incidents, {
      agencyId: AGENCY_ID,
      ...incident,
      status: "open",
      escalatedTo911: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  await put(TABLES.reports, {
    agencyId: AGENCY_ID,
    reportId: "trep-qr-1",
    source: "qr",
    summary: "Passenger reported crowded platform at Route 14 Stop 2",
    stationId: "r14-st-2",
    createdAt: now,
  });

  await put(TABLES.config, {
    agencyId: AGENCY_ID,
    sk: "CONFIG#alert",
    level: "nominal",
    updatedAt: now,
    updatedByUserId: "seed-transit",
  });

  console.log(`[seed-transit-test-agency] Seeded ${AGENCY_ID} (${vehicles.length} vehicles)`);
}

main().catch((error) => {
  console.error("[seed-transit-test-agency] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
