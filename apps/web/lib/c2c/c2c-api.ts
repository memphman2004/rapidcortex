import type { CADSlot, CADVendor } from "rapid-cortex-shared";

export interface C2cSlotView {
  slot: CADSlot;
  label: string;
  vendor: CADVendor;
  enabled: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  credentialsSecretArn: string;
  webhookUrl: string;
  baseUrl?: string;
}

export interface C2cSlotsResponse {
  agencyId: string;
  writebackEnabled: boolean;
  slots: C2cSlotView[];
  updatedAt: string;
}

class C2cApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "C2cApiError";
    this.status = status;
  }
}

async function c2cRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new C2cApiError(err.error ?? `C2C request failed (${res.status})`, res.status);
  }
  return body as T;
}

export function fetchC2cSlots() {
  return c2cRequest<C2cSlotsResponse>("/api/c2c/slots");
}

export function patchC2cSlot(
  slot: CADSlot,
  patch: Partial<Pick<C2cSlotView, "enabled" | "inboundEnabled" | "outboundEnabled" | "label" | "vendor">>,
) {
  return c2cRequest<C2cSlotsResponse>(`/api/c2c/slots/${slot}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function fetchC2cHealth() {
  return c2cRequest<{
    status: string;
    agencies: Array<{ agencyId: string; status: string; errorMessage?: string }>;
    checkedAt?: string;
  }>("/api/c2c/health");
}
