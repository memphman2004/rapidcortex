import { redirect } from "next/navigation";

/** Legacy alias — deactivated QR links land on the inactive intake page. */
export default function ReportExpiredPage() {
  redirect("/report/inactive");
}
