const VIDEO_WALL_BLOCKED_ROLES = new Set([
  "VENUE_GUEST_SERVICES",
  "VENUE_GUEST",
  "CAMPUS_FACULTY",
  "CAMPUS_COUNSELOR",
  "HOSPITAL_STAFF",
  "HOSPITAL_ADMIN",
  "HOSPITAL_COORDINATOR",
]);

export function isVideoWallRoleBlocked(role: string | undefined): boolean {
  const token = (role ?? "").trim().toUpperCase().replace(/-/g, "_");
  return VIDEO_WALL_BLOCKED_ROLES.has(token);
}
