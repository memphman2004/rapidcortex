import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { LearningClient } from "./learning-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function LearningPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await requireRole([
    "supervisor",
    "agencyadmin",
    "rcsuperadmin",
    "rcadmin",
  ]);
  if (!user) redirect(`/${jurisdiction}/login`);

  return (
    <LearningClient
      jurisdiction={jurisdiction}
      agencyId={user.agencyId}
    />
  );
}
