import { redirect } from "next/navigation";
import { marketingLoginPath } from "./marketing-links";

/** Developer guides are served on the app host behind session auth. */
export function redirectDevelopersDocsToSignIn(fromPath: string): never {
  redirect(`${marketingLoginPath()}?from=${encodeURIComponent(fromPath)}`);
}
