import { redirect } from "next/navigation";
import { AgencyInvoicesPanel } from "@/components/admin/agency-invoices-panel";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

type Props = { params: Promise<{ jurisdiction: string }> };

export default async function AgencyInvoicesPage({ params }: Props) {
  const { jurisdiction } = await params;
  const user = await getDashboardSessionUser();
  if (!user) redirect(`/${jurisdiction}/login`);

  return <AgencyInvoicesPanel />;
}
