import type { AgencyConfig } from "rapid-cortex-shared";
import { AgencyRepository } from "../repositories/agencyRepository.js";

export type ProviderSurface = "ai" | "stt" | "translation";
export type ProviderName = "openai" | "anthropic" | "bedrock" | "aws" | "google" | "azure" | "mock";

export type ProviderPolicyDecision = {
  allowed: boolean;
  reason: string;
  allowedProviders: ProviderName[];
  singleProviderMode: boolean;
  singleProvider?: ProviderName;
};

const agencies = new AgencyRepository();

function normalizeProvider(value: string): ProviderName | null {
  const v = value.trim().toLowerCase();
  if (v === "openai" || v === "anthropic" || v === "bedrock" || v === "aws" || v === "google" || v === "azure" || v === "mock") {
    return v;
  }
  return null;
}

function parseAllowlist(v: unknown): ProviderName[] {
  if (Array.isArray(v)) {
    return v
      .map((x) => (typeof x === "string" ? normalizeProvider(x) : null))
      .filter((x): x is ProviderName => x != null);
  }
  if (typeof v === "string") {
    return v
      .split(",")
      .map((x) => normalizeProvider(x))
      .filter((x): x is ProviderName => x != null);
  }
  return [];
}

function parseBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return fallback;
  const norm = v.trim().toLowerCase();
  if (norm === "true" || norm === "1" || norm === "yes") return true;
  if (norm === "false" || norm === "0" || norm === "no") return false;
  return fallback;
}

function defaultsForSurface(surface: ProviderSurface): ProviderName[] {
  if (surface === "ai") return ["openai", "anthropic", "bedrock", "mock"];
  return ["aws", "google", "azure", "mock"];
}

export function evaluateProviderPolicy(input: {
  provider: ProviderName;
  surface: ProviderSurface;
  config?: AgencyConfig;
}): ProviderPolicyDecision {
  const env = input.config?.environmentFlags ?? {};
  const prefix = input.surface;
  const allowlist = parseAllowlist(env[`${prefix}ProviderAllowlist`]) ?? [];
  const allowedProviders = allowlist.length > 0 ? allowlist : defaultsForSurface(input.surface);
  const singleProviderMode = parseBool(env[`${prefix}SingleProviderMode`], false);
  const singleProvider = normalizeProvider(String(env[`${prefix}SingleProvider`] ?? ""));

  const allowed = singleProviderMode
    ? singleProvider != null && input.provider === singleProvider
    : allowedProviders.includes(input.provider);

  return {
    allowed,
    reason: allowed
      ? "allowed_by_policy"
      : singleProviderMode
        ? "blocked_single_provider_mode"
        : "blocked_not_in_allowlist",
    allowedProviders,
    singleProviderMode,
    ...(singleProvider ? { singleProvider } : {}),
  };
}

export async function assertProviderAllowedForAgency(input: {
  agencyId: string;
  provider: ProviderName;
  surface: ProviderSurface;
}): Promise<ProviderPolicyDecision> {
  const agency = await agencies.get(input.agencyId);
  const decision = evaluateProviderPolicy({
    provider: input.provider,
    surface: input.surface,
    config: agency?.config,
  });

  console.log(
    JSON.stringify({
      type: "security.provider_policy",
      agencyId: input.agencyId,
      provider: input.provider,
      surface: input.surface,
      ...decision,
      at: new Date().toISOString(),
    }),
  );

  if (!decision.allowed) {
    throw new Error(
      `PROVIDER_POLICY_BLOCKED: ${input.surface} provider "${input.provider}" denied for agency ${input.agencyId}`,
    );
  }
  return decision;
}

export function inferProviderFromAdapterName(name: string): ProviderName {
  const n = name.toLowerCase();
  if (n.includes("openai")) return "openai";
  if (n.includes("anthropic")) return "anthropic";
  if (n.includes("bedrock")) return "bedrock";
  if (n.includes("google")) return "google";
  if (n.includes("azure")) return "azure";
  if (n.includes("aws") || n.includes("transcribe") || n.includes("translate")) return "aws";
  return "mock";
}
