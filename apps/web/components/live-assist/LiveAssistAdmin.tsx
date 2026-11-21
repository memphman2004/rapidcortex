"use client";

/**
 * LiveAssistAdmin — Administration panel
 *
 * Allows authorized administrators to:
 *   - View and configure camera providers (manufacturer connectors)
 *   - Register and manage devices
 *   - Validate provider connectivity
 *
 * Integration status meanings:
 *   vendor_authorization_required — NexCort iQ has not yet obtained API access from this manufacturer
 *   credentials_required          — Provider configured but awaiting credentials
 *   connected                     — Successfully validated
 *   limited_capabilities          — Partial connectivity
 *   disconnected / error          — Connection failed
 */
import { useProviders, useValidateProvider } from "@/lib/live-assist/hooks";

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  available_for_configuration: { label: "Available — configure to connect",    cls: "text-slate-400",    dot: "bg-slate-500" },
  vendor_authorization_required:{ label: "Vendor authorization required",       cls: "text-amber-400",   dot: "bg-amber-500" },
  credentials_required:        { label: "Credentials required",                cls: "text-yellow-400",  dot: "bg-yellow-500" },
  connected:                   { label: "Connected",                            cls: "text-green-400",   dot: "bg-green-500" },
  limited_capabilities:        { label: "Connected — limited capabilities",    cls: "text-orange-400",  dot: "bg-orange-500" },
  disconnected:                { label: "Disconnected",                         cls: "text-red-400",     dot: "bg-red-500" },
  unsupported:                 { label: "Unsupported",                          cls: "text-slate-600",   dot: "bg-slate-700" },
  error:                       { label: "Error",                                cls: "text-red-400",     dot: "bg-red-500" },
};

export function LiveAssistAdmin() {
  const providersQuery = useProviders();
  const validateMutation = useValidateProvider();

  const providers = providersQuery.data?.providers ?? [];

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-white">Live Assist Administration</h2>
        <p className="mt-1 text-xs text-slate-400">
          Configure body-worn camera providers, register devices, and manage coaching policies.
        </p>
      </div>

      {/* Provider catalog */}
      <section>
        <h3 className="text-sm font-medium text-slate-200 mb-3">Camera Provider Integrations</h3>
        {providersQuery.isLoading && (
          <p className="text-xs text-slate-500">Loading providers…</p>
        )}
        <div className="space-y-2">
          {providers.map((p) => {
            const cfg = STATUS_CONFIG[p.integrationStatus] ?? { label: p.integrationStatus, cls: "text-slate-400", dot: "bg-slate-500" };
            return (
              <div
                key={p.manufacturer}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{p.displayName}</p>
                      <p className={`mt-0.5 text-xs ${cfg.cls}`}>{cfg.label}</p>
                      {p.lastError && (
                        <p className="mt-1 text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1">
                          {p.lastError}
                        </p>
                      )}
                      {p.lastValidatedAt && (
                        <p className="mt-0.5 text-[10px] text-slate-600">
                          Last checked: {new Date(p.lastValidatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {p.documentationUrl && (
                      <a
                        href={p.documentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded px-2 py-1 text-xs text-sky-400 hover:text-sky-300 transition"
                      >
                        Docs ↗
                      </a>
                    )}
                    {p.providerId && (
                      <button
                        onClick={() => void validateMutation.mutateAsync(p.providerId!)}
                        disabled={validateMutation.isPending}
                        className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition"
                      >
                        Test Connection
                      </button>
                    )}
                  </div>
                </div>

                {/* Pending vendor auth notice */}
                {p.pendingVendorAuthorization && (
                  <div className="mt-3 rounded bg-amber-950/30 border border-amber-800/40 px-3 py-2 text-xs text-amber-300">
                    <strong>PENDING VENDOR AUTHORIZATION</strong> — NexCort iQ must obtain authorized API
                    access from this manufacturer before this integration can be enabled.
                    {p.documentationUrl && (
                      <>
                        {" "}See{" "}
                        <a href={p.documentationUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          manufacturer documentation
                        </a>
                        .
                      </>
                    )}
                  </div>
                )}

                {/* Capability summary */}
                {p.defaultCapabilities && Object.keys(p.defaultCapabilities).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {!!p.defaultCapabilities.liveVideoSupported && <CapTag label="Video" ok />}
                    {!!p.defaultCapabilities.liveAudioSupported && <CapTag label="Audio" ok />}
                    {!!p.defaultCapabilities.gpsSupported && <CapTag label="GPS" ok />}
                    {!!p.defaultCapabilities.remoteStreamActivationSupported && <CapTag label="Remote activate" ok />}
                    {!p.defaultCapabilities.liveVideoSupported && <CapTag label="Video" ok={false} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Coaching configuration placeholder */}
      <section>
        <h3 className="text-sm font-medium text-slate-200 mb-3">Coaching Configuration</h3>
        <div className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500 italic">
          Coaching channel configuration, officer device enrollment, and session authorization policy
          will be available here in a future update.
        </div>
      </section>
    </div>
  );
}

function CapTag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        ok ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-600 line-through"
      }`}
    >
      {label}
    </span>
  );
}
