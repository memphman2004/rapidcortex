"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import {
  Activity,
  Bell,
  FileText,
  Home,
  MapPin,
  MessageSquare,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { canVenueAgencyIt, canVenueNotifications } from "@/lib/venue/venue-access";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: ElementType;
  supervisorOnly?: boolean;
  agencyItOnly?: boolean;
  supervisorOrAgencyIt?: boolean;
};

function navItems(base: string): NavItem[] {
  return [
    { id: "home", label: "Home", href: base, icon: Home },
    { id: "ops", label: "Operations Center", href: base, icon: Activity },
    { id: "reports", label: "Reports", href: `${base}/reports`, icon: FileText },
    { id: "sections", label: "Sections", href: `${base}/sections`, icon: MapPin },
    { id: "staff", label: "Staff", href: `${base}/staff`, icon: Users },
    {
      id: "guest",
      label: "Guest Reports",
      href: `${base}/reports/guest`,
      icon: MessageSquare,
    },
    {
      id: "notify",
      label: "Notifications",
      href: `${base}/notifications`,
      icon: Bell,
      supervisorOnly: true,
    },
    {
      id: "settings",
      label: "Settings",
      href: `${base}/settings`,
      icon: Settings,
      agencyItOnly: true,
    },
    {
      id: "cameras",
      label: "Cameras",
      href: `${base}/settings/cameras`,
      icon: Video,
      supervisorOrAgencyIt: true,
    },
  ];
}


export function VenueNav({
  linkBase,
  userRole,
}: {
  linkBase: string;
  userRole?: string;
}) {
  const pathname = usePathname();
  const items = navItems(linkBase).filter((item) => {
    if (item.supervisorOnly && !canVenueNotifications(userRole)) return false;
    if (item.agencyItOnly && !canVenueAgencyIt(userRole)) return false;
    if (
      item.supervisorOrAgencyIt &&
      !canVenueNotifications(userRole) &&
      !canVenueAgencyIt(userRole)
    ) {
      return false;
    }
    return true;
  });

  return (
    <nav
      style={{
        width: 180,
        background: "var(--rc-surface-deep)",
        borderRight: `1px solid var(--rc-border)`,
        padding: "12px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === linkBase
            ? pathname === linkBase || pathname === `${linkBase}/operations`
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
              borderRadius: 6,
              textDecoration: "none",
              background: active ? "var(--rc-violet-dim)" : "transparent",
              border: `1px solid ${active ? "var(--rc-violet-border)" : "transparent"}`,
              color: active ? "var(--rc-violet)" : "var(--rc-text-secondary)",
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
