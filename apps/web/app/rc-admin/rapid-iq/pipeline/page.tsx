import { redirect } from "next/navigation";

/** Pipeline now lives as a toggle inside Rapid IQ. */
export default function RcAdminRapidIqPipelineRedirect() {
  redirect("/rc-admin/rapid-iq");
}
