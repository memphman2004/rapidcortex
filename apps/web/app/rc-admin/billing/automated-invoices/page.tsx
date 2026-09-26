import { redirect } from "next/navigation";

/** Alias for a common mistaken path — canonical RC admin URL is `/rc-admin/automated-invoices`. */
export default function BillingAutomatedInvoicesAliasPage() {
  redirect("/rc-admin/automated-invoices");
}
