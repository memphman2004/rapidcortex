import "server-only";

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgencyConfigRepository, AgencyConfigPatch } from "@/lib/rapid-cortex/agency/AgencyConfigRepository";
import {
  defaultAgencyConfigRecord,
  enforceAutomatedWriteBackSafety,
  type AgencyConfigRecord,
} from "@/lib/rapid-cortex/agency/defaultAgencyConfig";

type FileStore = {
  version: 1;
  agencies: Record<string, AgencyConfigRecord>;
};

const DEFAULT_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "agency-config.json",
);

function storePath(): string {
  return process.env.AGENCY_CONFIG_FILE_PATH?.trim() || DEFAULT_PATH;
}

async function readStore(): Promise<FileStore> {
  const p = storePath();
  try {
    const raw = await readFile(p, "utf8");
    const j = JSON.parse(raw) as FileStore;
    if (j?.version === 1 && j.agencies && typeof j.agencies === "object") return j;
  } catch {
    /* empty */
  }
  return { version: 1, agencies: {} };
}

async function writeStore(store: FileStore): Promise<void> {
  const p = storePath();
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(store, null, 2), "utf8");
}

function applyPatch(
  current: AgencyConfigRecord,
  patch: AgencyConfigPatch,
  updatedBy: string | undefined,
): AgencyConfigRecord {
  const mode = patch.cadIntegrationMode ?? current.cadIntegrationMode;
  const now = new Date().toISOString();
  return {
    ...current,
    ...patch,
    enabledAddOns: patch.enabledAddOns ?? current.enabledAddOns,
    limitedFeatureOverrides: patch.limitedFeatureOverrides ?? current.limitedFeatureOverrides,
    disabledFeatures: patch.disabledFeatures ?? current.disabledFeatures,
    cadIntegrationMode: enforceAutomatedWriteBackSafety(mode),
    writeBackEnabled: patch.writeBackEnabled ?? current.writeBackEnabled,
    agencyApprovedCadWriteBack: patch.agencyApprovedCadWriteBack ?? current.agencyApprovedCadWriteBack,
    auditLoggingEnabled: patch.auditLoggingEnabled ?? current.auditLoggingEnabled,
    sandboxMode: patch.sandboxMode ?? current.sandboxMode,
    updatedAt: now,
    updatedBy: updatedBy ?? current.updatedBy,
  };
}

export class FileAgencyConfigRepository implements AgencyConfigRepository {
  async getAgencyConfig(agencyId: string): Promise<AgencyConfigRecord | null> {
    const s = await readStore();
    return s.agencies[agencyId] ?? null;
  }

  async upsertAgencyConfig(config: AgencyConfigRecord): Promise<AgencyConfigRecord> {
    const s = await readStore();
    const safe: AgencyConfigRecord = {
      ...config,
      cadIntegrationMode: enforceAutomatedWriteBackSafety(config.cadIntegrationMode),
    };
    s.agencies[config.agencyId] = safe;
    await writeStore(s);
    return safe;
  }

  async patchAgencyConfig(agencyId: string, patch: AgencyConfigPatch, updatedBy?: string): Promise<AgencyConfigRecord> {
    const s = await readStore();
    const existing = s.agencies[agencyId] ?? defaultAgencyConfigRecord(agencyId);
    const next = applyPatch(existing, patch, updatedBy);
    s.agencies[agencyId] = next;
    await writeStore(s);
    return next;
  }

  async enableFeature(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = await this.get(agencyId);
    return this.patchAgencyConfig(
      agencyId,
      { disabledFeatures: base.disabledFeatures.filter((x) => x !== featureId) },
      updatedBy,
    );
  }

  async disableFeature(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = await this.get(agencyId);
    if (base.disabledFeatures.includes(featureId)) {
      return base;
    }
    return this.patchAgencyConfig(agencyId, { disabledFeatures: [...base.disabledFeatures, featureId] }, updatedBy);
  }

  async enableAddOn(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = await this.get(agencyId);
    if (base.enabledAddOns.includes(featureId)) {
      return base;
    }
    return this.patchAgencyConfig(agencyId, { enabledAddOns: [...base.enabledAddOns, featureId] }, updatedBy);
  }

  async disableAddOn(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    return this.patchAgencyConfig(
      agencyId,
      {
        enabledAddOns: (await this.get(agencyId)).enabledAddOns.filter((x) => x !== featureId),
      },
      updatedBy,
    );
  }

  private async get(agencyId: string): Promise<AgencyConfigRecord> {
    return (await this.getAgencyConfig(agencyId)) ?? defaultAgencyConfigRecord(agencyId);
  }
}
