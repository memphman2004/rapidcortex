import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { EventsClient } from "./events-client";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function EventsPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await requireRole([
    "supervisor",
    "agencyadmin",
    "rcsuperadmin",
    "rcadmin",
  ]);
  if (!user) redirect(`/${jurisdiction}/login`);

  return (
    <EventsClient
      jurisdiction={jurisdiction}
      agencyId={user.agencyId}
    />
  );
}
