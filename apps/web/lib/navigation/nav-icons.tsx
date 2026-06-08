import type { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { LayoutDashboard } from "lucide-react";

export function navIconByName(name: string): LucideIcon {
  const icon = (LucideIcons as Record<string, LucideIcon | undefined>)[name];
  return icon ?? LayoutDashboard;
}
