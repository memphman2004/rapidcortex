/** True when the path/method mutates campaign copy, approval, suppress, or Outlook. */
export function salesAutomationPathRequiresManage(
  method: string,
  segments: string[] | undefined,
): boolean {
  const m = method.toUpperCase();
  const path = (segments ?? []).join("/");
  // Email-list vertical moves share the same access bar as add (sales access), not campaign manage.
  if (m === "PATCH" && path === "email-list") return false;
  if (m === "DELETE" || m === "PATCH" || m === "PUT") return true;
  if (m !== "POST" && m !== "GET") return false;
  if (path.includes("approve") || path.includes("suppress")) return true;
  if (path.includes("outlook/connect") || path.includes("outlook/disconnect")) return true;
  if (path.includes("outlook/callback")) return true;
  // GET outlook/connect starts OAuth — manage-only
  if (m === "GET" && path.includes("outlook/connect")) return true;
  return false;
}
