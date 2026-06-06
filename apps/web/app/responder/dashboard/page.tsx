import { redirect } from "next/navigation";

/** Legacy URL; canonical shell is `/dispatcher/dashboard`. */
export default function ResponderDashboardRedirect() {
  redirect("/dispatcher/dashboard");
}
