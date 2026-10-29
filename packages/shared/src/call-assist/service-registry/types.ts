/** One reason a resident may call. The id stays stable so a later review can find the same row. */
export type CallAssistServiceRegistryEntry = {
  service_id: string;
  category: string;
  service_name: string;
  automation_level: string;
  risk_level: string;
  department: string;
  enabled_by_default: boolean;
  intake_schema: string;
  routing_rule: string;
  integration: string;
  sla: string;
  citizen_notification: string;
  notes: string;
};

export type CallAssistServiceRegistryDocument = {
  schema_version: string;
  status: "candidate_catalog_not_activated";
  services: readonly CallAssistServiceRegistryEntry[];
};
