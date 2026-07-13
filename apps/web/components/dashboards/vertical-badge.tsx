/** Server-safe re-exports. Pure helpers come from `@/lib/vertical` — never re-export them from the client badge module. */
export { VerticalBadge } from "@/components/ui/VerticalBadge";
export {
  VERTICAL_CONFIG,
  normalizeVertical,
  deriveVerticalFromAgencyId,
  resolveAgencyVerticalFromTenant,
  formatAgencyType,
  type Vertical as TenantVertical,
  type Vertical,
} from "@/lib/vertical";
