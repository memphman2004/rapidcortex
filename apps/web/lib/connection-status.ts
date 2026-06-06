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
 * Dispatch shell integration strip — pilot framing: API reflects real config; external CAD/radio
 * remain explicit non-goals for first-agency launch (see docs/NON_GOALS.md).
 */
export function getIntegrationStatusRows(): IntegrationStatusRow[] {
  const apiLive = isApiConfigured();
  return [
    {
      id: "api",
      label: "Rapid Cortex API",
      detail: apiLive
        ? "Live backend (cookie proxy or NEXT_PUBLIC_API_BASE)"
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
      detail: "Configure CAD connectors in Admin → Integrations",
      health: "planned",
    },
    {
      id: "audio",
      label: "Agency telephony / radio",
      detail: "Integration setup required for live ingest paths",
      health: "planned",
    },
  ];
}
