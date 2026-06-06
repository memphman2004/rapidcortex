import net from "node:net";
import type { Hl7FacilityMap } from "rapid-cortex-shared";

import { BedAggregator } from "./bed-aggregator.js";
import { buildCapacityFromCounts, CapacityWriter } from "./capacity-writer.js";
import { resolveFacility } from "./facility-map.js";
import { buildAckMessage, extractMllpMessages, type MllpAckCode } from "./mllp.js";
import { parseHl7AdtMessage } from "./parse-hl7-adt.js";

export class Hl7Listener {
  private readonly server: net.Server;
  private readonly beds = new BedAggregator();
  private readonly writer: CapacityWriter;

  constructor(
    private readonly facilityMap: Hl7FacilityMap,
    tableName: string,
    private readonly port: number,
    debounceMs: number,
  ) {
    this.writer = new CapacityWriter(tableName, debounceMs);
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`[hl7] MLLP listener on port ${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  /** Process a raw HL7 payload (no MLLP wrapper) — used by tests and mock mode. */
  async processRawMessage(raw: string): Promise<MllpAckCode> {
    return this.handlePayload(raw);
  }

  async flushPendingWrites(): Promise<void> {
    await this.writer.flush();
  }

  private handleConnection(socket: net.Socket) {
    console.log(`[hl7] connection from ${socket.remoteAddress ?? "unknown"}`);
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const { messages, remainder } = extractMllpMessages(buffer);
      buffer = remainder;

      for (const message of messages) {
        void this.handlePayload(message).then((ack) => {
          socket.write(buildAckMessage(ack, "MSG00001"));
        });
      }
    });

    socket.on("error", (err) => console.error("[hl7] socket error", err));
    socket.on("close", () => console.log("[hl7] connection closed"));
  }

  private async handlePayload(message: string): Promise<MllpAckCode> {
    try {
      const parsed = parseHl7AdtMessage(message);
      if (!parsed) {
        console.error("[hl7] parse failed");
        return "AR";
      }

      const facility = resolveFacility(this.facilityMap, parsed.sendingFacility);
      if (!facility) {
        console.error(`[hl7] unknown facility: ${parsed.sendingFacility}`);
        return "AR";
      }

      const totals = facility.bedTotals ?? { er: 25, icu: 12, trauma: 4 };
      this.beds.apply(facility.agencyId, facility.hospitalId, parsed.department, parsed.event);

      this.writer.schedulePush(facility.agencyId, facility.hospitalId, () =>
        buildCapacityFromCounts({
          agencyId: facility.agencyId,
          hospitalId: facility.hospitalId,
          bedTotals: totals,
          erOccupied: this.beds.getOccupied(facility.agencyId, facility.hospitalId, "er"),
          icuOccupied: this.beds.getOccupied(facility.agencyId, facility.hospitalId, "icu"),
          traumaOccupied: this.beds.getOccupied(facility.agencyId, facility.hospitalId, "trauma"),
        }),
      );

      return "AA";
    } catch (e) {
      console.error("[hl7] processing error", e);
      return "AE";
    }
  }
}
