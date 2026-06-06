import { NextResponse } from "next/server";
import { CadAdapterFactory, readCadConnectionConfig } from "@/lib/rapid-cortex/cad/cad-adapter-factory";
import { ensureAgencyAccess, requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";

const factory = new CadAdapterFactory();

export async function POST(request: Request) {
  const auth = await requireCadApiUser();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const agencyError = ensureAgencyAccess(auth.user.agencyId, body.agencyId);
  if (agencyError) {
    return NextResponse.json({ error: agencyError }, { status: 400 });
  }

  const config = readCadConnectionConfig(auth.user.agencyId);
  const adapter = factory.create(config);
  const result = await adapter.searchIncidents({
    agencyId: auth.user.agencyId,
    q: typeof body.q === "string" ? body.q : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    from: typeof body.from === "string" ? body.from : undefined,
    to: typeof body.to === "string" ? body.to : undefined,
    limit: typeof body.limit === "number" ? body.limit : undefined,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
