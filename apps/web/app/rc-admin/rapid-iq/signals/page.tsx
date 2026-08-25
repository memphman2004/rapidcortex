import { redirect } from "next/navigation";

/** Legacy Rapid IQ Signals / Pipeline URLs — UI now lives inside Rapid IQ. */
export default function RcAdminRapidIqSignalsRedirect() {
  redirect("/rc-admin/rapid-iq");
}
