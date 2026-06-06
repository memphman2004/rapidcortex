// TODO(prod): enforce `blockPrivateIpRanges` during outbound SSRF-critical fetches (webhooks/translator callbacks); hostname allowlist alone is incomplete.

export type IntegrationConnectorPolicy = {
  connectorId: string;
  /** Hostname allowlist patterns (suffix match), e.g. `.amazonaws.com`. */
  allowedHostSuffixes: string[];
  /** Block private IP ranges for outbound webhooks in production. */
  blockPrivateIpRanges: boolean;
};

export class IntegrationSecurityPolicy {
  evaluateOutboundUrl(url: string, policy: IntegrationConnectorPolicy): "allow" | "deny" {
    try {
      const host = new URL(url).hostname.toLowerCase();
      const ok = policy.allowedHostSuffixes.some((s) => host === s || host.endsWith(s));
      return ok ? "allow" : "deny";
    } catch {
      return "deny";
    }
  }

  defaultPolicy(): IntegrationConnectorPolicy {
    return {
      connectorId: "default",
      allowedHostSuffixes: [".amazonaws.com", ".amazoncognito.com"],
      blockPrivateIpRanges: true,
    };
  }
}
