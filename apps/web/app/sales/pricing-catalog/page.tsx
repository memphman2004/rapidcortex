import { SalesPricingCatalogClient } from "@/components/sales/sales-pricing-catalog-client";

export const metadata = {
  title: "Pricing Catalog",
  robots: { index: false, follow: false },
};

export default function SalesPricingCatalogPage() {
  return <SalesPricingCatalogClient />;
}
