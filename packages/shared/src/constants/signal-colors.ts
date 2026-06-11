export const ROLE_BAND_COLORS = {
  // ── Platform ──────────────────────────────────────────
  rcsuperadmin: { color: "#7C3AED", label: "Platform Command", vertical: "platform" },
  rcadmin: { color: "#7C3AED", label: "RC Operations", vertical: "platform" },
  rcitadmin: { color: "#7C3AED", label: "RC Infrastructure", vertical: "platform" },

  // ── RC 911 ────────────────────────────────────────────
  agencyadmin: { color: "#2979FF", label: "Agency Admin", vertical: "911" },
  agencyit: { color: "#2979FF", label: "Agency IT", vertical: "911" },
  supervisor: { color: "#2979FF", label: "Supervisor Console", vertical: "911" },
  dispatcher: { color: "#2979FF", label: "Dispatcher Console", vertical: "911" },
  analyst: { color: "#2979FF", label: "Analytics", vertical: "911" },
  auditor: { color: "#2979FF", label: "Audit", vertical: "911" },

  // ── RC Campus ─────────────────────────────────────────
  campus_admin: { color: "#10B981", label: "Campus Admin", vertical: "campus" },
  campus_supervisor: { color: "#10B981", label: "Campus Supervisor", vertical: "campus" },
  campus_security: { color: "#10B981", label: "Campus Security", vertical: "campus" },
  campus_counselor: { color: "#10B981", label: "Campus Counselor", vertical: "campus" },
  campus_faculty: { color: "#10B981", label: "Campus Faculty", vertical: "campus" },

  // ── RC Venue ──────────────────────────────────────────
  venue_admin: { color: "#F59E0B", label: "Venue Admin", vertical: "venue" },
  venue_supervisor: { color: "#F59E0B", label: "Venue Supervisor", vertical: "venue" },
  venue_security: { color: "#F59E0B", label: "Venue Security", vertical: "venue" },
  venue_operator: { color: "#F59E0B", label: "Venue Operator", vertical: "venue" },
  venue_guest: { color: "#F59E0B", label: "Venue Read Only", vertical: "venue" },

  // ── RC Hospital ───────────────────────────────────────
  hospital_admin: { color: "#EF4444", label: "Hospital Admin", vertical: "hospital" },
  hospital_supervisor: { color: "#EF4444", label: "Hospital Supervisor", vertical: "hospital" },
  hospital_staff: { color: "#EF4444", label: "Hospital Console", vertical: "hospital" },
  hospital_coord: { color: "#EF4444", label: "Hospital Coordinator", vertical: "hospital" },

  // ── RC Transit ────────────────────────────────────────
  transit_admin: { color: "#6366F1", label: "Transit Admin", vertical: "transit" },
  transit_supervisor: { color: "#6366F1", label: "Transit Supervisor", vertical: "transit" },
  transit_security: { color: "#6366F1", label: "Transit Console", vertical: "transit" },
  transit_operator: { color: "#6366F1", label: "Transit Operator", vertical: "transit" },
} as const;

export function roleBand(role: string) {
  return (
    ROLE_BAND_COLORS[role as keyof typeof ROLE_BAND_COLORS] ?? {
      color: "#475569",
      label: "Unknown Role",
      vertical: "unknown",
    }
  );
}
