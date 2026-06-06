import { Buffer } from "node:buffer";
import {
  CreateIPSetCommand,
  GetIPSetCommand,
  GetWebACLCommand,
  ListIPSetsCommand,
  UpdateIPSetCommand,
  UpdateWebACLCommand,
  WAFV2Client,
  type Rule,
  type VisibilityConfig,
} from "@aws-sdk/client-wafv2";
import type { AgencyNetworkPolicy } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const waf = new WAFV2Client({ region: env.region });

const BASE_RULE_PRIORITY = 100;

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ msg, ...extra }));
}

function wafSafeToken(agencyId: string): string {
  const safe = agencyId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return safe || "unknown";
}

function ipSetName(agencyId: string): string {
  return `rc-agency-${wafSafeToken(agencyId)}-allowlist`;
}

function allowlistRuleName(agencyId: string): string {
  return `RcAgencyAllow-${wafSafeToken(agencyId)}`;
}

function rulePriorityForAgency(agencyId: string): number {
  let h = 0;
  for (let i = 0; i < agencyId.length; i++) {
    h = (Math.imul(31, h) + agencyId.charCodeAt(i)) | 0;
  }
  return BASE_RULE_PRIORITY + (Math.abs(h) % 9000);
}

function parseRegionalWebAclArn(arn: string): { name: string; id: string } {
  const match = arn.match(/:regional\/webacl\/([^/]+)\/([a-f0-9-]+)$/i);
  if (!match) throw new Error("INVALID_WAF_WEB_ACL_ARN");
  return { name: match[1], id: match[2] };
}

function visibility(metricName: string): VisibilityConfig {
  return {
    SampledRequestsEnabled: true,
    CloudWatchMetricsEnabled: true,
    MetricName: metricName.slice(0, 128),
  };
}

function ipv4Addresses(cidrs: string[]): string[] {
  return cidrs.filter((c) => c.includes(".") && !c.includes(":"));
}

async function findIpSetByName(name: string, scope: "REGIONAL"): Promise<{ id: string; arn: string } | null> {
  let next: string | undefined;
  do {
    const res = await waf.send(
      new ListIPSetsCommand({ Scope: scope, Limit: 100, NextMarker: next }),
    );
    for (const summary of res.IPSets ?? []) {
      if (summary.Name === name && summary.Id && summary.ARN) {
        return { id: summary.Id, arn: summary.ARN };
      }
    }
    next = res.NextMarker;
  } while (next);
  return null;
}

async function upsertIpSet(
  name: string,
  addresses: string[],
  scope: "REGIONAL",
  existing?: { id: string; arn: string },
): Promise<{ id: string; arn: string }> {
  if (existing) {
    const current = await waf.send(
      new GetIPSetCommand({ Id: existing.id, Name: name, Scope: scope }),
    );
    const updated = await waf.send(
      new UpdateIPSetCommand({
        Id: existing.id,
        Name: name,
        Scope: scope,
        LockToken: current.LockToken,
        Addresses: addresses,
      }),
    );
    return { id: existing.id, arn: existing.arn };
  }

  const created = await waf.send(
    new CreateIPSetCommand({
      Name: name,
      Scope: scope,
      IPAddressVersion: "IPV4",
      Addresses: addresses,
    }),
  );
  if (!created.Summary?.Id || !created.Summary?.ARN) {
    throw new Error("CREATE_IP_SET_FAILED");
  }
  return { id: created.Summary.Id, arn: created.Summary.ARN };
}

function buildAllowlistRule(
  agencyId: string,
  ipSetArn: string,
  priority: number,
): Rule {
  const agencyHeader = new Uint8Array(Buffer.from(agencyId, "utf8"));
  return {
    Name: allowlistRuleName(agencyId),
    Priority: priority,
    Action: { Block: {} },
    Statement: {
      AndStatement: {
        Statements: [
          {
            ByteMatchStatement: {
              FieldToMatch: { SingleHeader: { Name: "x-agency-id" } },
              PositionalConstraint: "EXACTLY",
              SearchString: agencyHeader,
              TextTransformations: [{ Priority: 0, Type: "NONE" }],
            },
          },
          {
            NotStatement: {
              Statement: {
                IPSetReferenceStatement: { ARN: ipSetArn },
              },
            },
          },
        ],
      },
    },
    VisibilityConfig: visibility(allowlistRuleName(agencyId)),
  };
}

async function upsertWebAclRule(
  webAclArn: string,
  agencyId: string,
  ipSetArn: string,
  enabled: boolean,
): Promise<void> {
  const { name, id } = parseRegionalWebAclArn(webAclArn);
  const scope = "REGIONAL" as const;
  const acl = await waf.send(
    new GetWebACLCommand({ Name: name, Scope: scope, Id: id }),
  );
  const rules = [...(acl.WebACL?.Rules ?? [])];
  const ruleName = allowlistRuleName(agencyId);
  const without = rules.filter((r) => r.Name !== ruleName);

  let nextRules = without;
  if (enabled) {
    const rule = buildAllowlistRule(agencyId, ipSetArn, rulePriorityForAgency(agencyId));
    nextRules = [...without, rule].sort((a, b) => (a.Priority ?? 0) - (b.Priority ?? 0));
  }

  await waf.send(
    new UpdateWebACLCommand({
      Name: name,
      Scope: scope,
      Id: id,
      LockToken: acl.LockToken,
      DefaultAction: acl.WebACL?.DefaultAction ?? { Allow: {} },
      Rules: nextRules,
      VisibilityConfig:
        acl.WebACL?.VisibilityConfig ??
        visibility(`RcWafAcl-${wafSafeToken(name)}`),
    }),
  );
}

export type WafSyncOutcome = Pick<
  AgencyNetworkPolicy,
  "wafIpSetId" | "wafIpSetArn" | "wafSyncStatus" | "wafSyncedAt"
>;

/**
 * Sync agency allowlist CIDRs to a regional WAF IP set and optional per-agency Web ACL rule.
 * Lambda middleware remains authoritative; WAF is best-effort edge enforcement.
 */
export async function syncAgencyNetworkPolicyToWaf(
  agencyId: string,
  policy: AgencyNetworkPolicy,
): Promise<WafSyncOutcome> {
  const syncedAt = new Date().toISOString();
  const webAclArn = env.wafWebAclArn;
  const scope = (env.wafScope === "CLOUDFRONT" ? "CLOUDFRONT" : "REGIONAL") as "REGIONAL";

  if (!webAclArn) {
    return { wafSyncStatus: "not_configured", wafSyncedAt: syncedAt };
  }

  const setName = ipSetName(agencyId);
  const addresses = ipv4Addresses(policy.allowedCidrs.map((c) => c.cidr));

  let ipSetId = policy.wafIpSetId;
  let ipSetArn = policy.wafIpSetArn;

  if (!ipSetId || !ipSetArn) {
    const found = await findIpSetByName(setName, scope);
    if (found) {
      ipSetId = found.id;
      ipSetArn = found.arn;
    }
  }

  const existing =
    ipSetId && ipSetArn ? { id: ipSetId, arn: ipSetArn } : undefined;
  const ipSet = await upsertIpSet(setName, addresses, scope, existing);
  ipSetId = ipSet.id;
  ipSetArn = ipSet.arn;

  if (policy.ipAllowlistEnabled && addresses.length > 0) {
    await upsertWebAclRule(webAclArn, agencyId, ipSetArn, true);
    log("waf_allowlist_rule_enabled", { agencyId, ipSetArn });
  } else {
    await upsertWebAclRule(webAclArn, agencyId, ipSetArn, false);
    log("waf_allowlist_rule_removed", { agencyId });
  }

  return {
    wafIpSetId: ipSetId,
    wafIpSetArn: ipSetArn,
    wafSyncStatus: "synced",
    wafSyncedAt: syncedAt,
  };
}
