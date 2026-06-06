import { redirect } from "next/navigation";

type Props = { params: Promise<{ agencyId: string }> };

export default async function RcAdminAgencyIndexPage({ params }: Props) {
  const { agencyId } = await params;
  redirect(`/rc-admin/agencies/${encodeURIComponent(agencyId)}/features`);
}

