import type { EidoDocument } from "@rc/eido";
import { berkeleyDemoIncidents } from "../seed";
import type { C2cCadAdapter, HubIncident, TransferRecord } from "../types";

/**
 * In-memory CAD stand-in. Berkeley emits simulated incidents; Charleston
 * (or any sink) accumulates delivered EIDOs. This is the demo engine.
 */
export class MockCadAdapter implements C2cCadAdapter {
  readonly vendorId = "mock" as const;
  readonly received: TransferRecord[] = [];

  constructor(
    readonly agencyId: string,
    private readonly producer: () => HubIncident[] = () => [],
  ) {}

  ingest(): HubIncident[] {
    return this.producer().map((incident) => ({ ...incident }));
  }

  deliver(eido: EidoDocument, meta: { transferId: string; ruleId: string }): void {
    this.received.push({
      transferId: meta.transferId,
      ruleId: meta.ruleId,
      fromAgencyId: eido.issuingElementIdentification,
      toAgencyId: this.agencyId,
      incidentId: eido.incidentComponent?.[0]?.incidentNumber ?? eido.$id,
      eido,
      deliveredAt: new Date().toISOString(),
    });
  }

  receivedTransfers(): TransferRecord[] {
    return [...this.received];
  }
}

export function berkeleyMockAdapter(): MockCadAdapter {
  return new MockCadAdapter("berkeley-county-sc", () => berkeleyDemoIncidents());
}

export function charlestonMockAdapter(): MockCadAdapter {
  return new MockCadAdapter("charleston-county-sc");
}
