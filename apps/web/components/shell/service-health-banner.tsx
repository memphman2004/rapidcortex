type ServiceName = "core" | "cad" | "rms";
type ServiceStatus = "connected" | "degraded" | "disconnected";

const LABELS: Record<ServiceName, string> = {
  core: "NexCort iQ Intelligence",
  cad: "CAD Dispatch",
  rms: "Records Management",
};

/**
 * Shown when a licensed product is unreachable.
 * A product that is not licensed is omitted from navigation and does not use this banner.
 */
export function ServiceHealthBanner({
  service,
  status,
}: {
  service: ServiceName;
  status: ServiceStatus;
}) {
  if (status === "connected") return null;
  const detail =
    status === "disconnected"
      ? " Some features are unavailable. Your other services are unaffected."
      : " Operating in degraded mode. Some capabilities may be limited.";
  return (
    <div role="alert" className={`service-banner service-banner--${status} flex items-start gap-2 rounded-md border border-amber-700/60 bg-amber-950/80 px-3 py-2 text-sm text-amber-100`}>
      <span>
        {LABELS[service]} is currently {status}.{detail}
      </span>
    </div>
  );
}
