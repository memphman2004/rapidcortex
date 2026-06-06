import { BillingSelfServeNotice } from "@/components/billing/billing-self-serve-notice";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";

export const metadata = {
  title: "RC Lite procurement",
  robots: { index: false, follow: false },
};

export default async function RcLiteCheckoutPage() {
  const user = await getDashboardSessionUser();

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 sm:px-8">
      <BillingSelfServeNotice
        headline="RC Lite billing"
        subheadline="API access is awarded through pilots, invoicing, and agency procurement—not public card checkout."
        planName="RC Lite API Access"
        billingFrequency="monthly"
        includedFeatures={[
          "api_access and api_portal_access",
          "usage metering, webhooks, audit logs",
          "no dispatcher/supervisor/admin dashboard entitlements",
        ]}
        amountCents={49900}
        agencyIdPrefill={user?.agencyId}
        productLine="rc_lite"
      />
    </main>
  );
}
