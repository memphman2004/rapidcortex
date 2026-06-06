import { redirect } from "next/navigation";

/** Canonical RC Admin home — `/rc-admin` alone has no shell content. */
export default function RcAdminIndexPage() {
  redirect("/rc-admin/dashboard");
}
