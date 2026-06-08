import {
  isCadWritebackUiEnabled,
  isQaScoringEnabled,
} from "@/lib/runtime-flags";

/** Runtime feature gates for `NavItem.feature` keys in role-nav.ts. */
export function isNavFeatureEnabled(feature: string): boolean {
  switch (feature) {
    case "cadWriteback":
      return isCadWritebackUiEnabled();
    case "qaScoringEnabled":
      return isQaScoringEnabled();
    default:
      return true;
  }
}
