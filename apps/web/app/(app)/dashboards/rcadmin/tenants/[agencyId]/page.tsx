import { redirect } from "next/navigation";

type Props = { params: Promise<{ agencyId: string }> };

/** Legacy RC admin tenant add-ons URL — unified with RC Admin shell features page. */
export default async function RcAdminTenantAddonsPage({ params }: Props) {
  const { agencyId } = await params;
  redirect(`/rc-admin/agencies/${encodeURIComponent(agencyId)}/features`);
}
