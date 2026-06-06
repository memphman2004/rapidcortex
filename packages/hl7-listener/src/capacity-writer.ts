import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  hospitalCapacitySchema,
  type Hl7FacilityBedTotals,
  type HospitalCapacity,
} from "rapid-cortex-shared";

function pk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

function sk(hospitalId: string, timestamp: string): string {
  return `CAPACITY#${hospitalId}#${timestamp}`;
}

function bedCount(total: number, occupied: number) {
  const safeOccupied = Math.min(occupied, total);
  return {
    total,
    occupied: safeOccupied,
    available: Math.max(0, total - safeOccupied),
  };
}

export function buildCapacityFromCounts(input: {
  agencyId: string;
  hospitalId: string;
  bedTotals: Hl7FacilityBedTotals;
  erOccupied: number;
  icuOccupied: number;
  traumaOccupied: number;
}): HospitalCapacity {
  const erBeds = bedCount(input.bedTotals.er, input.erOccupied);
  const icuBeds = bedCount(input.bedTotals.icu, input.icuOccupied);
  const traumaBeds = bedCount(input.bedTotals.trauma, input.traumaOccupied);

  const erOccupancyRate = erBeds.total > 0 ? erBeds.occupied / erBeds.total : 0;
  const waitMinutes = Math.min(600, Math.round(erOccupancyRate * 60));
  const isOnDiversion = erOccupancyRate > 0.9;
  const now = new Date().toISOString();

  return hospitalCapacitySchema.parse({
    hospitalId: input.hospitalId,
    agencyId: input.agencyId,
    timestamp: now,
    availability: { erBeds, icuBeds, traumaBeds },
    waitTimes: {
      erWaitMinutes: waitMinutes,
      traumaBayMinutes: traumaBeds.available > 0 ? 5 : 30,
    },
    diversion: {
      isOnDiversion,
      diversionType: isOnDiversion ? "FULL" : undefined,
      diversionReason: isOnDiversion ? "ER at capacity (HL7 aggregate)" : undefined,
    },
    staffing: {
      adequateStaffing: erOccupancyRate < 0.85,
      erPhysicians: 2,
      erNurses: 4,
    },
    dataQuality: {
      source: "HL7_FEED",
      lastVerified: now,
      confidence: "HIGH",
    },
  });
}

export class CapacityWriter {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly debounceMs: number;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(tableName: string, debounceMs = 5000) {
    this.tableName = tableName;
    this.debounceMs = debounceMs;
    this.doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  schedulePush(
    agencyId: string,
    hospitalId: string,
    build: () => HospitalCapacity,
  ): void {
    if (this.debounceMs <= 0) {
      void this.push(build());
      return;
    }

    const key = `${agencyId}#${hospitalId}`;
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.push(build());
      }, this.debounceMs),
    );
  }

  async push(capacity: HospitalCapacity): Promise<void> {
    if (!this.tableName) {
      throw new Error("HOSPITAL_CAPACITY_TABLE not configured");
    }

    const row = {
      ...capacity,
      pk: pk(capacity.agencyId),
      sk: sk(capacity.hospitalId, capacity.timestamp),
      ttl: Math.floor(Date.now() / 1000) + 86400 * 7,
    };

    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: row,
      }),
    );

    console.log(
      `[hl7] capacity updated agency=${capacity.agencyId} hospital=${capacity.hospitalId} er=${capacity.availability.erBeds.available}/${capacity.availability.erBeds.total}`,
    );
  }

  async flush(): Promise<void> {
    await Promise.all(
      [...this.timers.values()].map(
        (t) =>
          new Promise<void>((resolve) => {
            clearTimeout(t);
            resolve();
          }),
      ),
    );
    this.timers.clear();
  }
}
