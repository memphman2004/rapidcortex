import { redirect } from "next/navigation";

/** Legacy URL — reviewer steps are internal only; homeowners use /connect/ring/start. */
export default function LegacyRingReviewRedirect() {
  redirect("/connect/ring/start");
}
