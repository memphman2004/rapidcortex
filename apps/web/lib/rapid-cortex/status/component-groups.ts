import { deriveWorstSystemStatus } from "@/lib/rapid-cortex/status/status-data";
import type { StatusComponent, SystemStatus } from "@/lib/rapid-cortex/status/status-types";

export type StatusComponentGroupDef = {
  readonly id: string;
  readonly title: string;
  readonly componentIds: readonly string[];
};

export const STATUS_COMPONENT_GROUPS: readonly StatusComponentGroupDef[] = [
  {
    id: "core",
    title: "Core Services",
    componentIds: ["web-application", "api-services", "authentication"],
  },
  {
    id: "operational-console",
    title: "Operational Console",
    componentIds: ["dispatcher-console", "supervisor-dashboard", "audit-logging"],
  },
  {
    id: "field-caller",
    title: "Field & Caller Workflows",
    componentIds: ["sms-caller-link-delivery", "media-uploads", "translation-services"],
  },
  {
    id: "integrations",
    title: "Integrations",
    componentIds: ["cad-read-only-integration", "public-website"],
  },
] as const;

export function groupStatusComponents(
  components: StatusComponent[],
): { group: StatusComponentGroupDef; components: StatusComponent[]; groupStatus: SystemStatus }[] {
  const byId = new Map(components.map((c) => [c.id, c]));
  return STATUS_COMPONENT_GROUPS.map((group) => {
    const list = group.componentIds
      .map((id) => byId.get(id))
      .filter((c): c is StatusComponent => Boolean(c));
    const groupStatus = deriveWorstSystemStatus(list.map((c) => c.status));
    return { group, components: list, groupStatus };
  });
}
