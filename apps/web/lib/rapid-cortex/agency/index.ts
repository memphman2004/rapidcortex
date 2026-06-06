import "server-only";

import type { AgencyConfigRepository } from "@/lib/rapid-cortex/agency/AgencyConfigRepository";
import { createAgencyConfigDynamoOrFile } from "@/lib/rapid-cortex/agency/DynamoAgencyConfigRepository";

let _repo: AgencyConfigRepository | null = null;

export function getAgencyConfigRepository(): AgencyConfigRepository {
  if (!_repo) {
    _repo = createAgencyConfigDynamoOrFile();
  }
  return _repo;
}

/** Test hook */
export function __resetAgencyConfigRepositoryForTests(repo: AgencyConfigRepository | null): void {
  _repo = repo;
}

export type { AgencyConfigRepository, AgencyConfigPatch } from "@/lib/rapid-cortex/agency/AgencyConfigRepository";
export { DynamoAgencyConfigRepository, createAgencyConfigDynamoOrFile } from "@/lib/rapid-cortex/agency/DynamoAgencyConfigRepository";
