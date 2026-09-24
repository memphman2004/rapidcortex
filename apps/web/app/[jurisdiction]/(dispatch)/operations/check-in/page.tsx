import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { CheckInClient } from "./check-in-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function CheckInPage({ params }: Props) {
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
    <CheckInClient
      jurisdiction={jurisdiction}
      agencyId={user.agencyId}
      userId={user.userId}
    />
  );
}
