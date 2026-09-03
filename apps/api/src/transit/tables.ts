export function transitTableEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} not set`);
  return value;
}

export const TRANSIT_TABLE_ENV = {
  vehicles: "TRANSIT_VEHICLES_TABLE",
  routes: "TRANSIT_ROUTES_TABLE",
  stations: "TRANSIT_STATIONS_TABLE",
  operators: "TRANSIT_OPERATORS_TABLE",
  incidents: "TRANSIT_INCIDENTS_TABLE",
  reports: "TRANSIT_REPORTS_TABLE",
  config: "TRANSIT_CONFIG_TABLE",
} as const;

export const TRANSIT_CONFIG_SK = "CONFIG#alert";
