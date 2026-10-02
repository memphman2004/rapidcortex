import type { EidoEnvelope } from "../eido/types.js";
import type { AgencyConfig, TransferRulesEngine } from "../transfer-rules/engine.js";

export class AgencyRegistry {
  private agencies = new Map<string, AgencyConfig>();

  constructor(private readonly rules?: TransferRulesEngine) {}

  async registerAgency(config: AgencyConfig): Promise<void> {
    this.agencies.set(config.agencyId, config);
  }

  async deregisterAgency(agencyId: string): Promise<void> {
    this.agencies.delete(agencyId);
  }

  async getAgency(agencyId: string): Promise<AgencyConfig | null> {
    return this.agencies.get(agencyId) ?? null;
  }

  async listAgencies(): Promise<AgencyConfig[]> {
    return [...this.agencies.values()];
  }

  async getAgenciesForTransfer(incident: EidoEnvelope): Promise<AgencyConfig[]> {
    const sender = incident.header.SenderAgencyId;
    if (!this.rules) return [...this.agencies.values()].filter((a) => a.agencyId !== sender);
    const result = await this.rules.evaluate(incident, sender, [...this.agencies.values()]);
    return result.decisions
      .map((d) => this.agencies.get(d.targetAgencyId))
      .filter((a): a is AgencyConfig => Boolean(a));
  }
}
