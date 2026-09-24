/** Keep NexCort Admin wizard next-steps inside `/rc-admin` instead of the public `/onboarding` prefix. */
export function verticalOnboardingContinueHref(pathname: string | null, pathAndQuery: string): string {
  if (pathname?.startsWith("/rc-admin") && pathAndQuery.startsWith("/onboarding/")) {
    return `/rc-admin${pathAndQuery}`;
  }
  return pathAndQuery;
}
