/**
 * Re-export shell theme API under the name used by the centralized theme docs.
 * Theme stays scoped to each dashboard shell (not `<html>`).
 */
export {
  ThemeProvider,
  useTheme as useRcTheme,
  useThemeRoot,
  type RcTheme,
} from "@/lib/theme/theme-context";
