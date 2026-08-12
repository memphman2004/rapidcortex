import { redirect } from "next/navigation";
import { canAccessContactsModule } from "rapid-cortex-shared";
import { ContactsClient } from "@/components/contacts/contacts-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isContactsModuleUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Company | Contacts",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ companyId: string }> };

export default async function RcAdminContactCompanyPage({ params }: Props) {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessContactsModule(user.role) || !isContactsModuleUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/contacts`);
  }
  const { companyId } = await params;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Contacts</h1>
      </div>
      <ContactsClient initialCompanyId={decodeURIComponent(companyId)} />
    </div>
  );
}
