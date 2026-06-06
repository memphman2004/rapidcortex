import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/rapid-cortex/server-auth";

export async function GET() {
  const user = await requireApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    items: [
      {
        id: "audit-preview-1",
        type: "feature.readiness",
        actor: user.email ?? "unknown",
        at: new Date().toISOString(),
        detail:
          "Audit API contract is available. Connect this route to backend audit repository for production.",
      },
    ],
  });
}
