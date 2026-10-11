/** True when the path/method mutates campaign copy, approval, suppress, or Outlook. */
export function salesAutomationPathRequiresManage(
  method: string,
  segments: string[] | undefined,
): boolean {
  const m = method.toUpperCase();
  if (m === "PATCH" || m === "PUT") return true;
  if (m !== "POST" && m !== "GET") return false;
  const path = (segments ?? []).join("/");
  if (path.includes("approve") || path.includes("suppress")) return true;
  if (path.includes("outlook/connect") || path.includes("outlook/disconnect")) return true;
  if (path.includes("outlook/callback")) return true;
  // GET outlook/connect starts OAuth — manage-only
  if (m === "GET" && path.includes("outlook/connect")) return true;
  return false;
}
