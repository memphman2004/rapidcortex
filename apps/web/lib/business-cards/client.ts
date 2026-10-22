export type BizCardStatus = {
  enabled: boolean;
  hasProfile: boolean;
  profileStatus?: string;
  activeProfiles?: number;
  totalProfiles?: number;
};

export async function bizCardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string; message?: string }) : ({} as T);
  if (!response.ok) {
    const message = (data as { message?: string; error?: string }).message || (data as { error?: string }).error || "Request failed";
    const error = new Error(message) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

export function businessCardSelfHref(pathname: string): string {
  if (pathname.startsWith("/app/campus/")) return `/app/campus/${pathname.split("/")[3]}/profile/business-card`;
  if (pathname.startsWith("/app/venue/")) return `/app/venue/${pathname.split("/")[3]}/profile/business-card`;
  if (pathname.startsWith("/transit/")) return `/transit/${pathname.split("/")[2]}/profile/business-card`;
  if (pathname.startsWith("/app/call-assist/")) return `/app/call-assist/${pathname.split("/")[3] || "operator"}/profile/business-card`;
  if (pathname.startsWith("/hospital-admin")) return "/hospital-admin/profile/business-card";
  if (pathname.startsWith("/hospital-staff")) return "/hospital-staff/profile/business-card";
  if (pathname.startsWith("/rc-admin")) return "/rc-admin/profile/business-card";
  const jurisdiction = pathname.split("/").filter(Boolean)[0];
  return jurisdiction ? `/${jurisdiction}/profile/business-card` : "/profile/business-card";
}
