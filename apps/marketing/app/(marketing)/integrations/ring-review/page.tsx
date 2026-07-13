import { redirect } from "next/navigation";

/** Legacy URL — reviewer steps are internal only; Ring Device Owners use /connect/ring/start. */
export default function LegacyRingReviewRedirect() {
  redirect("/connect/ring/start");
}
