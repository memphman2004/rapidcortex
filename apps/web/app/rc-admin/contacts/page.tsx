import { redirect } from "next/navigation";
import { canAccessContactsModule } from "rapid-cortex-shared";
import { ContactsClient } from "@/components/contacts/contacts-client";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import { isContactsModuleUiEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Contacts",
  robots: { index: false, follow: false },
};

export default async function RcAdminContactsPage() {
  const user = await getDashboardSessionUser();
  if (!user || !canAccessContactsModule(user.role) || !isContactsModuleUiEnabled()) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/contacts`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Contacts</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Shared sales address book for partners, prospects, competitors, vendors, influencers, and
          customers across 911, campus, and venue.
        </p>
      </div>
      <ContactsClient />
    </div>
  );
}
