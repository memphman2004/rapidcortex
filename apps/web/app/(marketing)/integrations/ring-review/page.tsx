import { redirect } from "next/navigation";

/** Legacy app-host path → static marketing homeowner landing. */
export default function LegacyRingReviewRedirect() {
  redirect("https://www.rapidcortex.us/connect/ring/start/");
}
