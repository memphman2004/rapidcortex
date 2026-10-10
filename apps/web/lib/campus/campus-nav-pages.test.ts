import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getRoleNav } from "@/lib/navigation/role-nav";

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAMPUS_ROLES = [
  "CAMPUS_ADMIN_K12",
  "CAMPUS_ADMIN_HIGHERED",
  "CAMPUS_SUPERVISOR_K12",
  "CAMPUS_SUPERVISOR_HIGHERED",
  "CAMPUS_SECURITY_K12",
  "CAMPUS_SECURITY_HIGHERED",
  "CAMPUS_DISPATCH_K12",
  "CAMPUS_DISPATCH_HIGHERED",
  "CAMPUS_COUNSELOR_K12",
  "CAMPUS_COUNSELOR_HIGHERED",
  "CAMPUS_FACULTY_K12",
  "CAMPUS_FACULTY_HIGHERED",
  // Legacy unsuffixed (aliases → K-12)
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
] as const;

function hrefToCampusPageFile(href: string): string | null {
  const pathname = href.split("?")[0] ?? href;
  if (!pathname.startsWith("/app/campus/")) return null;
  const rest = pathname.replace(/^\/app\/campus\/[^/]+/, "") || "/";
  if (rest === "/") return path.join(WEB_ROOT, "app/app/campus/[campusCode]/page.tsx");
  return path.join(WEB_ROOT, "app/app/campus/[campusCode]", rest, "page.tsx");
}

describe("campus dashboard nav hrefs", () => {
  it("every /app/campus/{code} nav item has a page.tsx", () => {
    const missing: string[] = [];
    for (const role of CAMPUS_ROLES) {
      const nav = getRoleNav(role, { campusCode: "UGA" });
      for (const item of nav.sections.flatMap((s) => s.items)) {
        const file = hrefToCampusPageFile(item.href);
        if (!file) {
          missing.push(`${role} ${item.id} ${item.href} (not a campus console path)`);
          continue;
        }
        if (!existsSync(file)) {
          missing.push(`${role} ${item.id} ${item.href} → ${path.relative(WEB_ROOT, file)}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
