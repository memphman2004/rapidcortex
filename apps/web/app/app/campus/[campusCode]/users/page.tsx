import type { Metadata } from "next";
import { CampusUsersClient } from "../_components/CampusUsersClient";
import { loadCampusAdminPageContext, resolveCampusDisplayName } from "@/lib/campus/campus-admin-page";

type Props = { params: Promise<{ campusCode: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campusCode } = await params;
  const label = await resolveCampusDisplayName(campusCode);
  return { title: `${label} — Users | Rapid Cortex` };
}

export default async function CampusUsersPage({ params }: Props) {
  const { campusCode: raw } = await params;
  const { campusCode, agencyId, user } = await loadCampusAdminPageContext(raw);

  if (!agencyId) {
    return (
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-5">
        <h2 className="text-lg font-semibold text-amber-100">Campus tenant not found</h2>
        <p className="mt-2 text-sm text-amber-200/80">
          No agency matches campus code <span className="font-mono">{campusCode}</span>.
        </p>
      </section>
    );
  }

  return (
    <CampusUsersClient campusCode={campusCode} agencyId={agencyId} callerRole={user.role} />
  );
}
