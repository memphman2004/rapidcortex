import { RestVendorCadAdapter } from "./rest-vendor-adapter.js";

/** Motorola PremierOne CAD adapter — live HTTP only after dual fail-closed gates and human review. */
export class MotorolaPremierOneAdapter extends RestVendorCadAdapter {
  constructor(natureMapping: Record<string, string> = {}) {
    super("motorola-premierone", natureMapping);
  }
}
