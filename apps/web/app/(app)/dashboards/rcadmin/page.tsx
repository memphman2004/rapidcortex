import { redirect } from "next/navigation";

export default function RcAdminDashboardIndexPage() {
  redirect("/dashboards/rcadmin/agencies");
}

