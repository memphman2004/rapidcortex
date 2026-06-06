export async function fetchFeatureRegistry() {
  const res = await fetch("/api/features", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load feature registry (${res.status})`);
  }
  return (await res.json()) as {
    agencyConfig: unknown;
    features: unknown[];
  };
}

export async function fetchAgencyConfig() {
  const res = await fetch("/api/agency/config", { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Failed to load agency config (${res.status})`);
  }
  return (await res.json()) as { agencyConfig: unknown };
}

export async function patchAgencyConfig(patch: Record<string, unknown>) {
  const res = await fetch("/api/agency/config", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Failed to update agency config (${res.status})`);
  }
  return (await res.json()) as { agencyConfig: unknown; message?: string };
}
