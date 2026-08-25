import { isApiConfigured } from "@/lib/api";
import { trainingModeCompactDetail } from "@/lib/training-mode";

export type IntegrationHealth = "live" | "mock" | "offline" | "planned";

export type IntegrationStatusRow = {
  id: string;
  label: string;
  detail: string;
  health: IntegrationHealth;
};

/**
 * Dispatch shell integration strip — API reflects real config; CAD read-only
 * webhook/poll adapters are available in Admin → CAD (write-back stays fail-closed).
 */
export function getIntegrationStatusRows(): IntegrationStatusRow[] {
  const apiLive = isApiConfigured();
  return [
    {
      id: "api",
      label: "Rapid Cortex API",
      detail: apiLive
        ? "Connected"
        : trainingModeCompactDetail(),
      health: apiLive ? "live" : "offline",
    },
    {
      id: "voice",
      label: "Multilingual voice",
      detail: apiLive
        ? "Available when agency language services are configured"
        : "Complete setup in Admin → Integrations",
      health: apiLive ? "live" : "offline",
    },
    {
      id: "cad",
      label: "CAD / RMS",
      detail: "Read-only PremierOne, CentralSquare, and Tyler — configure in Admin → CAD",
      health: apiLive ? "live" : "offline",
    },
    {
      id: "audio",
      label: "Agency telephony / radio",
      detail: "Integration setup required for live ingest paths",
      health: "planned",
    },
  ];
}
