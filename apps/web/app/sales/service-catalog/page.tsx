import { ServiceCatalogDashboard } from "@/components/billing/service-catalog-dashboard";

export const metadata = {
  title: "Service Catalog",
  robots: { index: false, follow: false },
};

export default function SalesServiceCatalogPage() {
  return (
    <ServiceCatalogDashboard hidePricing catalogApiPath="/api/sales/service-catalog" />
  );
}
