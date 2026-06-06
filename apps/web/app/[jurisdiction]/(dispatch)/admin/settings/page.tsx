import Link from "next/link";
import {
  CJIS_POLICY_CONFIG,
  ComplianceConfigService,
  IntegrationSecurityPolicy,
  RetentionPolicyService,
} from "rapid-cortex-security";

const envPlaceholders = [
  {
    key: "PRIMARY_PROVIDER / SECONDARY_PROVIDER / TERTIARY_PROVIDER",
    note: "openai | anthropic | bedrock | mock | off — set on Lambdas (SAM Globals). Staging/pilot/prod require a real chain unless AI_ALLOW_MOCK_ONLY_IN_PROD.",
  },
  { key: "OPENAI_API_KEY", note: "Lambda / Secrets Manager only; never commit." },
  { key: "COGNITO_USER_POOL_ID / CLIENT", note: "SAM stack outputs for browser auth." },
  { key: "API_UPSTREAM_BASE", note: "Next.js BFF proxy target for authenticated calls." },
  { key: "ALLOW_UNAUTHENTICATED_API", note: "Local only; must be false in production." },
] as const;

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AdminSettingsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const prefix = `/${jurisdiction}`;
  const retention = new RetentionPolicyService().getDefaultPolicy("tenant-default");
  const compliance = new ComplianceConfigService().getFlagsForEnvironment("production");
  const integrationPolicy = new IntegrationSecurityPolicy().defaultPolicy();
  const cjis = CJIS_POLICY_CONFIG;

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Environment & compliance</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          CJIS-aligned posture is about controls and evidence — not a certification badge. Values
          are set in deploy targets; this page is the operator map.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href={`${prefix}/admin/settings/downloads`}
            className="text-sky-400 hover:text-sky-300 hover:underline"
          >
            Downloads → Desktop Apps (Mac)
          </Link>
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
          Retention (model)
        </h2>
        <dl className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Transcript retention</dt>
            <dd>{retention.transcriptRetentionDays} days</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Analysis retention</dt>
            <dd>{retention.analysisRetentionDays} days</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Audit retention</dt>
            <dd>{retention.auditRetentionDays} days</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Legal hold</dt>
            <dd>{retention.legalHold ? "On" : "Off"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Dynamo TTL / purge jobs consume this model per agency (Phase 9 scaffold).
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-200/90">
          Compliance flags (production profile)
        </h2>
        <ul className="mt-3 list-inside list-disc text-sm text-slate-300">
          <li>Redact transcript in audit: {String(compliance.redactTranscriptInAudit)}</li>
          <li>KMS at rest required: {String(compliance.kmsAtRestRequired)}</li>
          <li>Enforce TLS: {String(compliance.enforceTls)}</li>
          <li>Secrets manager boundary: {String(compliance.secretsManagerBoundary)}</li>
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-teal-200/90">
          Integration security (default policy)
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          Connector: {integrationPolicy.connectorId} · allow suffixes:{" "}
          {integrationPolicy.allowedHostSuffixes.join(", ")}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Example evaluation:{" "}
          <code className="text-slate-400">
            {new IntegrationSecurityPolicy().evaluateOutboundUrl(
              "https://dynamodb.us-east-1.amazonaws.com/",
              integrationPolicy,
            )}
          </code>
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          CJIS-aligned control list ({cjis.documentId} v{cjis.version})
        </h2>
        <ul className="mt-3 list-inside list-decimal text-sm text-slate-300">
          {cjis.controls.map((c) => (
            <li key={c} className="mb-1">
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Environment variables
        </h2>
        <ul className="mt-4 max-w-3xl space-y-3">
          {envPlaceholders.map((p) => (
            <li
              key={p.key}
              className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm"
            >
              <div className="font-mono text-xs text-sky-300">{p.key}</div>
              <p className="mt-1 text-xs text-slate-400">{p.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
