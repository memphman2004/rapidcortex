export function existingNfcToolHref(pathname: string): string {
  if (pathname.startsWith("/rc-admin")) return "/rc-admin/qr-nfc";
  if (pathname.startsWith("/app/campus/")) {
    const code = pathname.split("/")[3];
    return code && code !== "admin" ? `/app/campus/${code}/qr-codes` : "/app/campus/admin/qr-codes";
  }
  if (pathname.startsWith("/app/venue")) return "/app/venue/admin/qr-codes";
  if (pathname.startsWith("/transit/") || pathname.startsWith("/app/transit")) return "/app/transit/admin/qr-codes";
  const jurisdiction = pathname.split("/").filter(Boolean)[0];
  return jurisdiction ? `/${jurisdiction}/admin/qr-codes` : "/admin/qr-codes";
}
