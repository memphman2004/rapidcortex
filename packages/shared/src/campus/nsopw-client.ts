/**
 * NSOPW public search client — Lambda / server only. Never import from browser bundles.
 */

export interface NsopwSearchParams {
  firstName: string;
  lastName: string;
  /** 2-letter USPS code */
  state?: string;
}

export interface NsopwOffender {
  fullName: string;
  registrationState: string;
  offenseDescription?: string;
  photoUrl?: string;
}

export interface NsopwResult {
  matchCount: number;
  matches: NsopwOffender[];
  searchedAt: string;
  apiError?: boolean;
}

const NSOPW_BASE = "https://www.nsopw.gov/api/Search/GetSearchResult";

export async function searchNsopw(params: NsopwSearchParams): Promise<NsopwResult> {
  const searchedAt = new Date().toISOString();
  const query = new URLSearchParams({
    namefirst: params.firstName.trim(),
    namelast: params.lastName.trim(),
    ...(params.state ? { statecd: params.state } : {}),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${NSOPW_BASE}?${query}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "NexCortiQ-CampusSafety/1.0",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return { matchCount: 0, matches: [], searchedAt, apiError: true };
    const data = (await res.json()) as {
      Count?: number;
      Offenders?: Array<{
        FullName?: string;
        StateName?: string;
        Offense?: string;
        PhotoUrl?: string;
      }>;
    };
    const matches: NsopwOffender[] = (data.Offenders ?? []).map((o) => ({
      fullName: o.FullName ?? "",
      registrationState: o.StateName ?? "",
      offenseDescription: o.Offense,
      photoUrl: o.PhotoUrl,
    }));
    return { matchCount: data.Count ?? matches.length, matches, searchedAt };
  } catch {
    clearTimeout(timeout);
    return { matchCount: 0, matches: [], searchedAt, apiError: true };
  }
}
