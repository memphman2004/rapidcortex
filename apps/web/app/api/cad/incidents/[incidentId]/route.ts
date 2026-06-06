import { NextResponse } from "next/server";
import { CadAdapterFactory, readCadConnectionConfig } from "@/lib/rapid-cortex/cad/cad-adapter-factory";
import { requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";

const factory = new CadAdapterFactory();

type Ctx = { params: Promise<{ incidentId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireCadApiUser();
  if (!auth.ok) return auth.response;

  const { incidentId } = await ctx.params;
  if (!incidentId?.trim()) {
    return NextResponse.json({ error: "incidentId is required." }, { status: 400 });
  }

  const config = readCadConnectionConfig(auth.user.agencyId);
  const adapter = factory.create(config);
  const result = await adapter.getIncident(incidentId);
  const status = result.ok ? 200 : result.error?.code === "NOT_FOUND" ? 404 : 503;
  return NextResponse.json(result, { status });
}
