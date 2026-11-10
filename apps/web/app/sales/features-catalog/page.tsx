import { SalesPricingCatalogClient } from "@/components/sales/sales-pricing-catalog-client";

export const metadata = {
  title: "Features Catalog",
  robots: { index: false, follow: false },
};

export default function SalesFeaturesCatalogPage() {
  return <SalesPricingCatalogClient />;
}
