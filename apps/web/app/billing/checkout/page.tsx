import { BillingSelfServeNotice } from "@/components/billing/billing-self-serve-notice";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = {
  title: "Billing & procurement",
  robots: { index: false, follow: false },
};

export default async function BillingCheckoutPage() {
  const user = await getDashboardSessionUser();

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 sm:px-8">
      <BillingSelfServeNotice
        headline="Rapid Cortex billing"
        subheadline="Your agency’s purchase is finalized through contracts, pilots, invoices, purchase orders, and Rapid Cortex procurement support."
        planName="Rapid Cortex Command"
        billingFrequency="monthly"
        includedFeatures={[
          "dispatcher + supervisor dashboard access",
          "incident command workflow and QA-ready visibility",
          "audit-ready operations and tenant controls",
        ]}
        amountCents={499900}
        agencyIdPrefill={user?.agencyId}
        productLine="rapid_cortex"
      />
    </main>
  );
}
