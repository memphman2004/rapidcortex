import { redirect } from "next/navigation";

/** Redirect to static marketing host (apps/marketing → S3/CloudFront). */
export default function MarketingRedirectPage() {
  redirect("https://www.rapidcortex.us/solutions/vendors/");
}
