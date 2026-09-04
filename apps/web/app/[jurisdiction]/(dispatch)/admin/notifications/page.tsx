import { redirect } from "next/navigation";

type Props = { params: Promise<{ jurisdiction: string }> };

/** Notification preference UI is not shipped; keep bookmarks from landing on a stub. */
export default async function AdminNotificationsPage({ params }: Props) {
  const { jurisdiction } = await params;
  redirect(`/${jurisdiction}/admin/settings`);
}
