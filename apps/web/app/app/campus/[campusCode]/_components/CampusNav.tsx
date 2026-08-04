"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { filterRoleNavByFeatures } from "@/lib/navigation/filter-role-nav";
import { navIconByName } from "@/lib/navigation/nav-icons";
import { getRoleNav, type NavItem } from "@/lib/navigation/role-nav";

const C = {
  surface: "#0d1321",
  border: "rgba(255,255,255,0.07)",
  text: "#e2e8f0",
  textSub: "#94a3b8",
  textMuted: "#64748b",
  blue: "#3b82f6",
} as const;

function navItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href || pathname === `${item.href}/`;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function CampusNav({
  campusCode,
  role = "CAMPUS_SUPERVISOR",
}: {
  campusCode: string;
  role?: string;
}) {
  const pathname = usePathname() ?? "";
  const navRole = isRcInternalOperator(role) ? "CAMPUS_ADMIN" : role;
  const nav = useMemo(
    () =>
      filterRoleNavByFeatures(
        getRoleNav(navRole, { campusCode: campusCode.toUpperCase() }),
      ),
    [navRole, campusCode],
  );

  const items = nav.sections.flatMap((s) => s.items);

  return (
    <nav
      className="w-full rounded-[10px] p-2"
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
      }}
      aria-label="Campus navigation"
    >
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const Icon = navIconByName(item.icon);
          const active = navItemActive(pathname, item);
          return (
            <Link
              key={item.id}
              href={item.href}
              className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] no-underline transition-colors"
              style={{
                background: active ? "rgba(59,130,246,0.13)" : "transparent",
                borderLeft: active ? `2px solid ${C.blue}` : "2px solid transparent",
                color: active ? C.text : C.textSub,
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={14} color={active ? C.blue : C.textMuted} strokeWidth={1.7} />
              {item.label}
              {item.badge?.type === "label" ? (
                <span className="text-[8.5px] font-bold" style={{ color: C.textMuted }}>
                  {item.badge.text}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
