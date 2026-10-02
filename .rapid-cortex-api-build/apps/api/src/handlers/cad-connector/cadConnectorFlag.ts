/** Fail-closed: unset or any value other than true/1 disables Multi-CAD Connector. */
export function cadConnectorEnabled(): boolean {
  const v = process.env.ENABLE_CAD_CONNECTOR?.trim().toLowerCase();
  return v === "true" || v === "1";
}
