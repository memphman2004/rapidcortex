"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import {
  Activity,
  AlertTriangle,
  Bus,
  FileText,
  Map,
  MapPin,
  Radio,
  Settings,
  Users,
} from "lucide-react";
import {
  canTransitAdminOps,
  canTransitDispatchOps,
  canTransitSupervisorOps,
} from "@/lib/vertical/supervisor-access";
import { T } from "./transit-theme";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ElementType;
  supervisorOnly?: boolean;
  adminOnly?: boolean;
  dispatchOnly?: boolean;
};

function navItems(base: string): NavItem[] {
  return [
    { id: "home", label: "Home", href: base, icon: Activity },
    { id: "fleet", label: "Fleet", href: `${base}/fleet`, icon: Map },
    { id: "routes", label: "Routes", href: `${base}/routes`, icon: Bus },
    { id: "stations", label: "Stations", href: `${base}/stations`, icon: MapPin },
    { id: "operators", label: "Operators", href: `${base}/operators`, icon: Users, dispatchOnly: true },
    { id: "incidents", label: "Incidents", href: `${base}/incidents`, icon: AlertTriangle },
    { id: "reports", label: "Reports", href: `${base}/reports`, icon: FileText },
    {
      id: "notify",
      label: "Broadcast",
      href: `${base}/incidents`,
      icon: Radio,
      supervisorOnly: true,
    },
    {
      id: "settings-vehicles",
      label: "Vehicles",
      href: `${base}/settings/vehicles`,
      icon: Settings,
      adminOnly: true,
    },
    {
      id: "settings-routes",
      label: "Route registry",
      href: `${base}/settings/routes`,
      icon: Map,
      adminOnly: true,
    },
    {
      id: "cameras",
      label: "Cameras",
      href: `${base}/settings/cameras`,
      icon: Radio,
      adminOnly: true,
    },
  ];
}

export function TransitNav({
  linkBase,
  userRole,
}: {
  linkBase: string;
  userRole?: string;
}) {
  const pathname = usePathname();
  const items = navItems(linkBase).filter((item) => {
    if (item.supervisorOnly && !canTransitSupervisorOps(userRole)) return false;
    if (item.adminOnly && !canTransitAdminOps(userRole)) return false;
    if (item.dispatchOnly && !canTransitDispatchOps(userRole)) return false;
    return true;
  });

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        background: T.surface,
        borderRight: `1px solid ${T.border}`,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === linkBase
            ? pathname === linkBase || pathname === `${linkBase}/` || pathname.endsWith("/dashboard")
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 8,
              textDecoration: "none",
              color: active ? T.blue : T.textSecondary,
              background: active ? T.blueDim : "transparent",
              fontSize: 12,
              fontWeight: active ? 700 : 500,
            }}
          >
            <Icon size={14} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
