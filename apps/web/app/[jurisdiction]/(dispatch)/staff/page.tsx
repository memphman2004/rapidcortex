import { redirect } from "next/navigation";

type Props = { params: Promise<{ jurisdiction: string }> };

/** Legacy `/staff` portal is not an active NexCort iQ role home. */
export default async function StaffDashboardPage({ params }: Props) {
  const { jurisdiction } = await params;
  redirect(`/${jurisdiction}/login`);
}
