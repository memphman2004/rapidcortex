import type { ICadAdapter, IAdapterRegistry } from "./adapter.interface.js";

export class AdapterRegistry implements IAdapterRegistry {
  private adapters = new Map<string, ICadAdapter>();

  register(adapter: ICadAdapter): void {
    this.adapters.set(adapter.agencyId, adapter);
  }

  get(agencyId: string): ICadAdapter | undefined {
    return this.adapters.get(agencyId);
  }

  getAll(): ICadAdapter[] {
    return [...this.adapters.values()];
  }

  has(agencyId: string): boolean {
    return this.adapters.has(agencyId);
  }

  remove(agencyId: string): void {
    this.adapters.delete(agencyId);
  }
}
