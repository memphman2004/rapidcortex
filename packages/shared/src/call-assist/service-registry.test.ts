import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listCitizenCallReasons } from "./citizen-call-reasons.js";
import {
  getServiceRegistryEntry,
  listServiceRegistryCategories,
  listServiceRegistryEntries,
  NEXCORT_311_SERVICE_REGISTRY,
} from "./service-registry/index.js";

const catalogPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "service-registry/nexcort-311-service-catalog.json",
);

describe("311 service registry", () => {
  it("keeps all 1,163 candidate services disabled and in catalog order", () => {
    const services = NEXCORT_311_SERVICE_REGISTRY.services;
    expect(NEXCORT_311_SERVICE_REGISTRY.status).toBe("candidate_catalog_not_activated");
    expect(services).toHaveLength(1163);
    expect(listCitizenCallReasons()).toHaveLength(1163);
    expect(services.map((service) => service.service_id)).toEqual(
      Array.from({ length: 1163 }, (_, index) => `NC311-${String(index + 1).padStart(4, "0")}`),
    );
    expect(services.every((service) => service.enabled_by_default === false)).toBe(true);
    expect(listServiceRegistryCategories()).toEqual([
      "Police Non-Emergency",
      "Fire Prevention",
      "EMS Administration",
      "Streets and Public Works",
      "Sanitation and Recycling",
      "Water Sewer and Utilities",
      "Code Enforcement",
      "Permits Planning and Zoning",
      "Animal Services",
      "Public Health",
      "Environmental Services",
      "Parks and Recreation",
      "Housing and Social Services",
      "Transit and Parking",
      "Government and Civic",
      "Libraries Education and Culture",
      "Emergency Preparedness",
      "Economic Development",
      "Property Tax and Land Records",
      "311 Operations",
      "Courts and Corrections",
      "Consumer Protection",
      "Digital and Broadband",
      "Airports Ports and Ferries",
      "Cemeteries and Memorials",
      "Specialized Municipal Services",
    ]);
  });

  it("matches the source catalog and looks up a service by its stable id", () => {
    const source = JSON.parse(readFileSync(catalogPath, "utf8")) as {
      services: Array<{ service_id: string; service_name: string }>;
    };
    expect(source.services).toEqual(NEXCORT_311_SERVICE_REGISTRY.services);
    expect(getServiceRegistryEntry("NC311-0155")?.service_name).toBe("Potholes");
    expect(getServiceRegistryEntry("NC311-0246")?.category).toBe("Sanitation and Recycling");
    expect(listServiceRegistryEntries("Fire Prevention")).toHaveLength(45);
    expect(getServiceRegistryEntry("NC311-9999")).toBeUndefined();
  });
});
