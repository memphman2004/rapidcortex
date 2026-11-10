import { redirect } from "next/navigation";

export const metadata = {
  title: "Features Catalog",
  robots: { index: false, follow: false },
};

/** Legacy path — Features Catalog is canonical at /sales/features-catalog. */
export default function SalesPricingCatalogRedirectPage() {
  redirect("/sales/features-catalog");
}
