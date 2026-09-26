import { redirect } from "next/navigation";

/** Legacy NexiQ Signals / Pipeline URLs — UI now lives inside NexiQ. */
export default function RcAdminRapidIqSignalsRedirect() {
  redirect("/rc-admin/rapid-iq");
}
