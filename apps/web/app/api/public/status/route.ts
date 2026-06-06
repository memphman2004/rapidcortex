import { NextResponse } from "next/server";
import { getPublicStatusPayload } from "@/lib/rapid-cortex/status/public-status-payload";

export async function GET() {
  return NextResponse.json(getPublicStatusPayload());
}
