import { redirect } from "next/navigation";

/** Any `/responder` URL forwards to the canonical dispatcher workspace shell. */
export default function LegacyResponderRedirect() {
  redirect("/dispatcher/dashboard");
}
