import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";

const CONTENT: Record<string, { title: string; body: ReactNode }> = {
  authentication: {
    title: "Authentication & API keys",
    body: (
      <>
        <p>
          Provide <span className="font-mono text-slate-300">X-RC-API-Key</span>{" "}
          <span className="text-slate-500">or</span>{" "}
          <span className="font-mono text-slate-300">Authorization: Bearer rk_…</span>. Keys are salted + hashed server-side —
          plaintext is shown exactly once during provisioning. Rotate keys periodically; disabled keys deny immediately across
          the fleet.
        </p>
        <p className="mt-4">
          Scopes (e.g. <span className="font-mono text-slate-400">cad:write</span>) constrain each route in the{" "}
          <Link href="/openapi/rc-lite-v1.openapi.yaml" className="font-medium text-sky-400 hover:text-sky-300">
            published RC Lite OpenAPI document
          </Link>
          .
        </p>
      </>
    ),
  },
  "incident-intelligence": {
    title: "Incident intelligence",
    body: (
      <p>
        Endpoints live under <span className="font-mono text-slate-300">/api/v1/intelligence/*</span>. Include{" "}
        <span className="font-mono text-slate-300">X-Request-Id</span> on each call whenever possible so support can trace traffic.
        Some routes may respond with rollout-specific status until workloads are enabled for your tenant.
      </p>
    ),
  },
  "cad-export": {
    title: "CAD export",
    body: (
      <p>
        POST requests require <span className="font-mono text-slate-300">Idempotency-Key</span> for export mutations. Hooks
        emit webhook events such as <span className="font-mono text-slate-400">cad.export.created</span>. This path never
        enables Rapid Cortex dispatcher/supervisor UIs—it is API egress only for partner CAD stacks.
      </p>
    ),
  },
  transcription: {
    title: "Transcription",
    body: (
      <p>Use <span className="font-mono text-slate-300">POST /api/v1/transcription/jobs</span> and poll/job GET patterns.</p>
    ),
  },
  translation: {
    title: "Translation",
    body: (
      <p>
        Text/audio translation mirrors PSAP multilingual policies; payload schemas align with Incident Intelligence bilingual
        fields.
      </p>
    ),
  },
  "caller-links": {
    title: "Caller links & media",
    body: (
        <p>
          Create shareable caller links plus short-lived upload access from your approved dispatch console — not from public
          marketing pages.
        </p>
    ),
  },
  webhooks: {
    title: "Webhooks",
    body: (
      <>
        <p>
          Subscribe to curated events (<span className="font-mono text-[13px] text-slate-400">incident.analyzed</span>,{" "}
          <span className="font-mono text-[13px] text-slate-400">cad.export.created</span>, transcription + translation lifecycle,
          media + QA completions). Signing secrets rotate independently from API keys; retries use exponential backoff.
        </p>
      </>
    ),
  },
};

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return Object.keys(CONTENT).map((path) => ({
    slug: path.split("/"),
  }));
}

export default async function DevelopersDocPage({ params }: Props) {
  const { slug } = await params;
  const path = slug?.join("/") ?? "";
  const section = CONTENT[path];
  if (!section) {
    notFound();
  }

  return (
    <MarketingArticleShell eyebrow="Docs" title={section.title} sectionLabel="Developers">
      <div className="prose prose-invert prose-sm mt-6 max-w-3xl text-slate-300">{section.body}</div>
      <Link href="/developers/docs" className="mt-10 inline-flex text-sm text-sky-400 hover:text-sky-300">
        ← Documentation hub
      </Link>
    </MarketingArticleShell>
  );
}
