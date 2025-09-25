import { NextRequest, NextResponse } from "next/server";
import { checkVariation } from "@/src/services/mimit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoIdParam = searchParams.get('impiantoId');
    const fuelType = searchParams.get('fuelType') || undefined;
    const onlyDown = (searchParams.get('onlyDown') || '').toLowerCase() === 'true';
    const verbose = (searchParams.get('verbose') || '').toLowerCase() === 'true';
    const impiantoId = impiantoIdParam ? Number(impiantoIdParam) : undefined;

    const result = await checkVariation({ impiantoId, fuelType, onlyDown, verbose });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


