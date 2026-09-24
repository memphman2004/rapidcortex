import { redirect } from "next/navigation";

/** Legacy NexiQ IQ Signals / Pipeline URLs — UI now lives inside NexiQ IQ. */
export default function RcAdminRapidIqSignalsRedirect() {
  redirect("/rc-admin/rapid-iq");
}
