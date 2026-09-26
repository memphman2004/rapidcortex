import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { AssessmentsClient } from "./assessments-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AssessmentsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await requireRole([
    "agencyadmin",
    "supervisor",
    "rcsuperadmin",
    "rcadmin",
  ]);
  if (!user) redirect(`/${jurisdiction}/login`);

  return (
    <AssessmentsClient
      jurisdiction={jurisdiction}
      agencyId={user.agencyId}
    />
  );
}
