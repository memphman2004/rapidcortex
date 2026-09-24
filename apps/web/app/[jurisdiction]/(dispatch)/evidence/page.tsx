import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { EvidenceClient } from "./evidence-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function EvidencePage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await requireRole([
    "dispatcher",
    "supervisor",
    "agencyadmin",
    "rcsuperadmin",
    "rcadmin",
  ]);
  if (!user) redirect(`/${jurisdiction}/login`);

  return (
    <EvidenceClient
      jurisdiction={jurisdiction}
      agencyId={user.agencyId}
    />
  );
}
