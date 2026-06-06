import Link from "next/link";
import { listDefaultPackIds } from "rapid-cortex-protocols";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AdminProtocolsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const to = (path: string) =>
    `/${jurisdiction}${path.startsWith("/") ? path : `/${path}`}`;
  const packIds = listDefaultPackIds();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Protocol packs</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Agency-level protocol selection will map to Dynamo configuration and the analysis prompt
          registry. This screen lists the built-in catalog for pilot review.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Default catalog
        </h2>
        <ul className="mt-3 list-inside list-disc font-mono text-sm text-slate-300">
          {packIds.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Per-agency overrides and version pinning are Phase 10 follow-ups on the API side.
        </p>
      </section>

      <p className="text-sm text-slate-400">
        <Link href={to("/admin")} className="text-sky-400 hover:underline">
          ← Admin overview
        </Link>
      </p>
    </div>
  );
}
