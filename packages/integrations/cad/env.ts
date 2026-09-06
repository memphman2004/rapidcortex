/** CAD Connector mock/dry-run — no live vendor HTTP, KMS, or Secrets Manager. */
export function isCadConnectorMock(): boolean {
  const v = process.env.CAD_CONNECTOR_MOCK?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function cadConnectorTableNames(): {
  connectors: string;
  incidents: string;
  writebacks: string;
  audit: string;
} {
  return {
    connectors: process.env.CAD_CONNECTORS_TABLE?.trim() ?? "",
    incidents: process.env.CAD_UNIFIED_INCIDENTS_TABLE?.trim() ?? "",
    writebacks: process.env.CAD_CONNECTOR_WRITEBACKS_TABLE?.trim() ?? "",
    audit: process.env.CAD_CONNECTOR_AUDIT_TABLE?.trim() ?? "",
  };
}

export function cadConnectorKmsKeyId(): string {
  return process.env.CAD_CONNECTOR_KMS_KEY_ID?.trim() ?? "";
}

export function cadConnectorSecretsPrefix(): string {
  const stage = process.env.DEPLOYMENT_STAGE?.trim() || "dev";
  return `rapid-cortex/${stage}/cad`;
}

export const AGENCY_ROUTING_CONNECTOR_ID = "__agency_routing__";
