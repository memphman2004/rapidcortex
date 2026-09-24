import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { SocialClient } from "./social-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function SocialPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await requireRole([
    "supervisor",
    "agencyadmin",
    "rcsuperadmin",
    "rcadmin",
  ]);
  if (!user) redirect(`/${jurisdiction}/login`);

  return (
    <SocialClient
      jurisdiction={jurisdiction}
      agencyId={user.agencyId}
    />
  );
}
