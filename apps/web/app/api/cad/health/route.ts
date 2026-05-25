import { type NextRequest, NextResponse } from "next/server";
import { resolveCadAdapter } from "@/lib/rapid-cortex/cad";
import { CadAdapterFactory, readCadConnectionConfig } from "@/lib/rapid-cortex/cad/cad-adapter-factory";
import { requireCadApiUser } from "@/lib/rapid-cortex/cad/cad-api-auth";

const factory = new CadAdapterFactory();

/** Read-only shim for pilot smoke / monitoring (matches `[[...segments]]` GET /health). */
export async function GET() {
  const health = await resolveCadAdapter().healthCheck();
  return NextResponse.json({ health });
}

export async function POST(request: NextRequest) {
  const auth = await requireCadApiUser();
  if (!auth.ok) return auth.response;

  const config = readCadConnectionConfig(auth.user.agencyId);
  const adapter = factory.create(config);
  const health = await adapter.healthCheck();
  const connection = await adapter.validateConnection(config);

  return NextResponse.json({
    ok: health.ok && connection.ok,
    vendor: config.vendor,
    mode: config.mode,
    health,
    connection,
  });
}
