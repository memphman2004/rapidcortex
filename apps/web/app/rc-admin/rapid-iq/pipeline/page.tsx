import { redirect } from "next/navigation";

/** Pipeline now lives as a toggle inside NexiQ. */
export default function RcAdminRapidIqPipelineRedirect() {
  redirect("/rc-admin/rapid-iq");
}
